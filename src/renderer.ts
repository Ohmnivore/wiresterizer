class WireRenderer {

    // To avoid fat arrow for callbacks ('this' woes)
    protected static instance: WireRenderer;

    // Update timer
    updateRate: number;
    protected updateInterval: number;
    protected lastTS: number;
    preUpdate: ((elapsed: number) => void) | null;

    // Screen buffer
    protected canvas: HTMLCanvasElement;
    protected context: CanvasRenderingContext2D;
    protected screenBuffer: ImageData;
    protected screenBufferArray: ArrayBuffer;
    protected screenBufferArrayU8: Uint8ClampedArray;
    protected screenBufferArrayU32: Uint32Array;
    protected oldWidth: number;
    protected oldHeight: number;

    // Global rendering variables
    screenWidth: number;
    screenHeight: number;
    screenAspectRatio: number;
    bgValue: number;
    wireValue: number;

    // Scene
    camera: WireCamera;
    models: WireModel[];

    // Per-frame variables to avoid allocations
    protected mvpMat: mat4;
    protected vert1: vec3;
    protected vert2: vec3;

    constructor(canvas: HTMLCanvasElement, updateRate: number, bgValue: number, wireValue: number) {
        this.canvas = canvas;
        this.screenWidth = canvas.width;
        this.screenHeight = canvas.height;
        this.screenAspectRatio = this.screenWidth / this.screenHeight;
        this.context = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
        this.screenBuffer = this.context.createImageData(canvas.width, canvas.height);
        this.screenBufferArray = new ArrayBuffer(this.screenBuffer.data.length);
        this.screenBufferArrayU8 = new Uint8ClampedArray(this.screenBufferArray);
        this.screenBufferArrayU32 = new Uint32Array(this.screenBufferArray);
        this.oldHeight = -1;
        this.oldWidth = -1;

        this.bgValue = bgValue;
        this.wireValue = wireValue;

        this.updateRate = updateRate;
        this.updateInterval = 0.0;
        this.lastTS = 0.0;

        this.camera = new WireCamera();
        this.models = [];

        // Per-frame variables
        this.mvpMat = new mat4();
        this.vert1 = new vec3();
        this.vert2 = new vec3();

        WireRenderer.instance = this;
    }

    launch() {
        let bypassTypeSystem: any = window;
        // Taken from http://www.javascriptkit.com/javatutors/requestanimationframe.shtml
        window.requestAnimationFrame = bypassTypeSystem.requestAnimationFrame
            || bypassTypeSystem.mozRequestAnimationFrame
            || bypassTypeSystem.webkitRequestAnimationFrame
            || bypassTypeSystem.msRequestAnimationFrame;

        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(WireRenderer.stepFrameCallbackAnimationFrame);
        }
        else {
            clearInterval(this.updateInterval);
            this.updateInterval = setInterval(WireRenderer.stepFrameCallbackSetInterval, 1000.0 / this.updateRate);
        }
    }

    protected static stepFrameCallbackAnimationFrame(timestamp: number) {
        WireRenderer.instance.stepFrame(timestamp);
    }

    protected static stepFrameCallbackSetInterval() {
        WireRenderer.instance.stepFrame(+new Date());
    }

    protected stepFrame(timestamp: number) {
        // Compute delta time since last update
        let lastTS = this.lastTS || timestamp;
        let dtSec = (timestamp - lastTS) / 1000.0;
        this.lastTS = timestamp;

        this.update(dtSec);

        if (window.requestAnimationFrame) {
            window.requestAnimationFrame((timestamp: number) => this.stepFrame(timestamp));
        }
    }

    update(elapsed: number) {
        // Update canvas size
        let targetWidth = Math.min(640, window.innerWidth);
        let targetHeight = Math.min(480, window.innerHeight);

        if (targetWidth / targetHeight < 1.333) {
            targetHeight = targetWidth / 1.333;
        }

        this.canvas.width = this.screenWidth = targetWidth;
        this.canvas.height = this.screenHeight = targetHeight;

        if (this.screenWidth != this.oldWidth || this.screenHeight != this.oldHeight) {
            this.screenBuffer = this.context.createImageData(this.screenWidth, this.screenHeight);
            this.screenBufferArray = new ArrayBuffer(this.screenBuffer.data.length);
            this.screenBufferArrayU8 = new Uint8ClampedArray(this.screenBufferArray);
            this.screenBufferArrayU32 = new Uint32Array(this.screenBufferArray);
        }
        this.oldWidth = this.screenWidth;
        this.oldHeight = this.screenHeight;

        // Clear screen
        this.screenBufferArrayU32.fill(this.bgValue);

        // Call pre-update callback
        if (this.preUpdate != null) {
            this.preUpdate(elapsed);
        }

        // Update camera
        this.screenAspectRatio = this.screenWidth / this.screenHeight;
        this.camera.setPerspective(this.camera.fov, this.screenAspectRatio, this.camera.near, this.camera.far);
        this.camera.updateCamMats();

        // N-gons
        // Draw models
        for (let modelIdx = 0; modelIdx < this.models.length; ++modelIdx) {
            let model = this.models[modelIdx]

            this.mvpMat.copyFrom(this.camera.viewProjectionMat);
            this.mvpMat.multiply(model.mat);

            let face_addr = 0;
            for (let face_idx = 0; face_idx < model.num_faces; ++face_idx) {
                let num_verts = model.verts[face_addr];
                face_addr++;

                this.vert1.x = model.verts[face_addr];
                this.vert1.y = model.verts[face_addr + 1];
                this.vert1.z = model.verts[face_addr + 2];
                this.mvpMat.multiplyVec3(this.vert1, this.vert1);

                for (let vert_idx = 1; vert_idx <= num_verts; ++vert_idx) {
                    let vert_2_addr = face_addr + (vert_idx % num_verts) * 3;

                    this.vert2.x = model.verts[vert_2_addr];
                    this.vert2.y = model.verts[vert_2_addr + 1];
                    this.vert2.z = model.verts[vert_2_addr + 2];
                    this.mvpMat.multiplyVec3(this.vert2, this.vert2);

                    let v1clip = this.vert1.z < this.camera.near;
                    let v2clip = this.vert2.z < this.camera.near;

                    // Skip if both clipped
                    if (!(v1clip && v2clip)) {
                        if (v1clip) {
                            let tempVert1 = new vec3(this.vert1.xyz);
                            let tempVert2 = new vec3(this.vert2.xyz);
                            this.zClip(tempVert2, tempVert1)
                            this.toCanvas(tempVert1);
                            this.toCanvas(tempVert2);

                            this.CohenSutherlandLineClipAndDraw(tempVert1.x, tempVert1.y, tempVert2.x, tempVert2.y);
                        }
                        else if (v2clip) {
                            let tempVert1 = new vec3(this.vert1.xyz);
                            let tempVert2 = new vec3(this.vert2.xyz);
                            this.zClip(tempVert1, tempVert2)
                            this.toCanvas(tempVert1);
                            this.toCanvas(tempVert2);

                            this.CohenSutherlandLineClipAndDraw(tempVert1.x, tempVert1.y, tempVert2.x, tempVert2.y);
                        }
                        else {
                            let tempVert1 = new vec3(this.vert1.xyz);
                            let tempVert2 = new vec3(this.vert2.xyz);
                            this.toCanvas(tempVert1);
                            this.toCanvas(tempVert2);

                            this.CohenSutherlandLineClipAndDraw(tempVert1.x, tempVert1.y, tempVert2.x, tempVert2.y);
                        }
                    }

                    this.vert1.copyFrom(this.vert2);
                }

                face_addr += num_verts * 3;
            }
        }

        // Swap buffers
        this.screenBuffer.data.set(this.screenBufferArrayU8);
        this.context.putImageData(this.screenBuffer, 0, 0);
    }

    zClip(constVert: vec3, vertToClip: vec3) {
        let dist = constVert.z - vertToClip.z;
        let newDist = constVert.z - this.camera.near;
        let ratio = newDist / dist;
        vertToClip.x = constVert.x + (vertToClip.x - constVert.x) * ratio;
        vertToClip.y = constVert.y + (vertToClip.y - constVert.y) * ratio;
        vertToClip.z = this.camera.near;
    }

    toCanvas(pos: vec3) {
        pos.x = ((pos.x / pos.z * this.screenWidth / 1.0) + this.screenWidth) / 2.0;
        pos.y = this.screenHeight - ((pos.y / pos.z * this.screenHeight / 1.0) + this.screenHeight) / 2.0;
    }

    setPixel(x: number, y: number) {
        x = Math.floor(x);
        y = Math.floor(y);

        // We have no view frustum clipping, this is necessary if the scene
        // allows objects to overflow the screen
        // if (base < 0 || (base + 3) >= (this.screenWidth * this.screenHeight * 4)) {
        //     return;
        // }

        this.screenBufferArrayU32[y * this.screenWidth + x] = this.wireValue;
    }


    // Taken from https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm

    private static INSIDE = 0; // 0000
    private static LEFT = 1;   // 0001
    private static RIGHT = 2;  // 0010
    private static BOTTOM = 4; // 0100
    private static TOP = 8;    // 1000

    // Compute the bit code for a point (x, y) using the clip rectangle
    // bounded diagonally by (xmin, ymin), and (xmax, ymax)
    private computeOutCode(x: number, y: number) {
        let code = WireRenderer.INSIDE;    // initialised as being inside of [[clip window]]

        if (x < 0.0)       // to the left of clip window
            code |= WireRenderer.LEFT;
        else if (x > this.screenWidth)   // to the right of clip window
            code |= WireRenderer.RIGHT;
        if (y < 0.0)       // below the clip window
            code |= WireRenderer.BOTTOM;
        else if (y > this.screenHeight)   // above the clip window
            code |= WireRenderer.TOP;

        return code;
    }

    // Cohen–Sutherland clipping algorithm clips a line from
    // P0 = (x0, y0) to P1 = (x1, y1) against a rectangle with 
    // diagonal from (xmin, ymin) to (xmax, ymax).
    private CohenSutherlandLineClipAndDraw(x0: number, y0: number, x1: number, y1: number)
    {
        // compute outcodes for P0, P1, and whatever point lies outside the clip rectangle
        let outcode0 = this.computeOutCode(x0, y0);
        let outcode1 = this.computeOutCode(x1, y1);
        let accept = false;

        while (true) {
            if (!(outcode0 | outcode1)) {
                // bitwise OR is 0: both points inside window; trivially accept and exit loop
                accept = true;
                break;
            }
            else if (outcode0 & outcode1) {
                // bitwise AND is not 0: both points share an outside zone (LEFT, RIGHT, TOP,
                // or BOTTOM), so both must be outside window; exit loop (accept is false)
                break;
            }
            else {
                // failed both tests, so calculate the line segment to clip
                // from an outside point to an intersection with clip edge
                let x = 0;
                let y = 0;

                // At least one endpoint is outside the clip rectangle; pick it.
                let outcodeOut = outcode0 ? outcode0 : outcode1;

                // Now find the intersection point;
                // use formulas:
                //   slope = (y1 - y0) / (x1 - x0)
                //   x = x0 + (1 / slope) * (ym - y0), where ym is ymin or ymax
                //   y = y0 + slope * (xm - x0), where xm is xmin or xmax
                // No need to worry about divide-by-zero because, in each case, the
                // outcode bit being tested guarantees the denominator is non-zero
                if (outcodeOut & WireRenderer.TOP) {         // point is above the clip window
                    x = x0 + (x1 - x0) * (this.screenHeight - y0) / (y1 - y0);
                    y = this.screenHeight;
                }
                else if (outcodeOut & WireRenderer.BOTTOM) { // point is below the clip window
                    x = x0 + (x1 - x0) * (0.0 - y0) / (y1 - y0);
                    y = 0.0;
                }
                else if (outcodeOut & WireRenderer.RIGHT) {  // point is to the right of clip window
                    y = y0 + (y1 - y0) * (this.screenWidth - x0) / (x1 - x0);
                    x = this.screenWidth;
                }
                else if (outcodeOut & WireRenderer.LEFT) {   // point is to the left of clip window
                    y = y0 + (y1 - y0) * (0.0 - x0) / (x1 - x0);
                    x = 0.0;
                }

                // Now we move outside point to intersection point to clip
                // and get ready for next pass.
                if (outcodeOut == outcode0) {
                    x0 = x;
                    y0 = y;
                    outcode0 = this.computeOutCode(x0, y0);
                }
                else {
                    x1 = x;
                    y1 = y;
                    outcode1 = this.computeOutCode(x1, y1);
                }
            }
        }

        if (accept) {
            this.drawLine(x0, y0, x1, y1);
        }
    }


    // Taken from http://tech-algorithm.com/articles/drawing-line-using-bresenham-algorithm
    drawLine(x: number, y: number, x2: number, y2: number) {
        let w = x2 - x;
        let h = y2 - y;

        let dx1 = 0, dy1 = 0, dx2 = 0, dy2 = 0;

        if (w < 0)
            dx1 = -1;
        else if (w > 0)
            dx1 = 1;

        if (h < 0)
            dy1 = -1;
        else if (h > 0)
            dy1 = 1;

        if (w < 0)
            dx2 = -1;
        else if (w > 0)
            dx2 = 1;

        let longest = Math.abs(w);
        let shortest = Math.abs(h);

        if (!(longest > shortest)) {
            longest = Math.abs(h);
            shortest = Math.abs(w);

            if (h < 0)
                dy2 = -1;
            else if (h > 0)
                dy2 = 1;

            dx2 = 0;
        }

        let numerator = longest >> 1;

        for (let i = 0; i <= longest; i++) {
            this.setPixel(x, y);

            numerator += shortest;

            if (!(numerator<longest)) {
                numerator -= longest;
                x += dx1;
                y += dy1;
            }
            else {
                x += dx2;
                y += dy2;
            }
        }
    }
}
