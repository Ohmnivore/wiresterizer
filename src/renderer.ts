class WireRenderer {

    // To avoid fat arrow for callbacks ('this' woes)
    protected static instance: WireRenderer;

    // Update timer
    updateRate: number;
    protected updateInterval: number;
    protected lastTS: number;

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
        this.context = canvas.getContext("2d") as CanvasRenderingContext2D;
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

        this.setUpdateRate(this.updateRate);

        WireRenderer.instance = this;
    }

    setUpdateRate(hz: number) {
        this.updateRate = hz;

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
                this.toCanvas(this.vert1);

                for (let vert_idx = 1; vert_idx <= num_verts; ++vert_idx) {
                    let vert_2_addr = face_addr + (vert_idx % num_verts) * 3;

                    this.vert2.x = model.verts[vert_2_addr];
                    this.vert2.y = model.verts[vert_2_addr + 1];
                    this.vert2.z = model.verts[vert_2_addr + 2];
                    this.mvpMat.multiplyVec3(this.vert2, this.vert2);
                    this.toCanvas(this.vert2);

                    this.drawLine(this.vert1.x, this.vert1.y, this.vert2.x, this.vert2.y);
                    this.vert1.copyFrom(this.vert2);
                }

                face_addr += num_verts * 3;
            }
        }

        // Swap buffers
        this.screenBuffer.data.set(this.screenBufferArrayU8);
        this.context.putImageData(this.screenBuffer, 0, 0);
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
