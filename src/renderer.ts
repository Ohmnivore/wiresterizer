class WireRenderer {

    // Update timer
    updateRate: number;
    protected updateInterval: number;
    protected lastTS: number;

    // Screen buffer
    protected canvas: HTMLCanvasElement;
    protected context: CanvasRenderingContext2D;
    protected screenBuffer: ImageData;

    // Global rendering variables
    public screenWidth: number;
    public screenHeight: number;
    public screenAspectRatio: number;
    public bgValue: number;
    public wireValue: number;

    // Scene
    public camera: WireCamera;
    public models: WireModel[];

    // Per-frame variables to avoid allocations
    private mvpMat: mat4;
    private vert1: vec3;
    private vert2: vec3;
    private vert3: vec3;
    private vert4: vec3;

    constructor(canvas: HTMLCanvasElement, updateRate: number, bgValue: number, wireValue: number) {
        this.canvas = canvas;
        this.screenWidth = canvas.width;
        this.screenHeight = canvas.height;
        this.screenAspectRatio = this.screenWidth / this.screenHeight;
        this.context = canvas.getContext("2d") as CanvasRenderingContext2D;
        this.screenBuffer = this.context.createImageData(canvas.width, canvas.height);

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
        this.vert3 = new vec3();
        this.vert4 = new vec3();

        this.setUpdateRate(this.updateRate);
    }

    setUpdateRate(hz: number) {
        this.updateRate = hz;

        clearInterval(this.updateInterval);
        this.updateInterval = setInterval(
                (function(self) { return function() { self.update(); }; })(this),
                1000 / this.updateRate
            );
    }

    update() {
        // Compute delta time since last update
        let nowTS = +new Date();
        let lastTS = this.lastTS || nowTS;
        let dtSec = (nowTS - lastTS) / 1000.0;
        this.lastTS = nowTS;

        //console.log(dtSec);

        // Clear screen
        this.screenBuffer.data.fill(this.bgValue);

        // Update camera
        this.camera.updateCamMats();

        // Quads
        // // Draw models
        // this.models.forEach(model => {
        //     this.camera.viewProjectionMat.copy(this.mvpMat);
        //     this.mvpMat.multiply(model.mat);

        //     //model.mat.copy(this.mvpMat);
        //     //this.mvpMat.multiply(this.camera.viewProjectionMat);

        //     for (let face_idx = 0; face_idx < model.num_faces; ++face_idx) {
        //         let face_base = face_idx * 12;

        //         this.vert1.x = model.verts[face_base];
        //         this.vert1.y = model.verts[face_base +  1];
        //         this.vert1.z = model.verts[face_base +  2];

        //         this.vert2.x = model.verts[face_base +  3];
        //         this.vert2.y = model.verts[face_base +  4];
        //         this.vert2.z = model.verts[face_base +  5];

        //         this.vert3.x = model.verts[face_base +  6];
        //         this.vert3.y = model.verts[face_base +  7];
        //         this.vert3.z = model.verts[face_base +  8];

        //         this.vert4.x = model.verts[face_base +  9];
        //         this.vert4.y = model.verts[face_base + 10];
        //         this.vert4.z = model.verts[face_base + 11];

        //         this.mvpMat.multiplyVec3(this.vert1, this.vert1);
        //         this.mvpMat.multiplyVec3(this.vert2, this.vert2);
        //         this.mvpMat.multiplyVec3(this.vert3, this.vert3);
        //         this.mvpMat.multiplyVec3(this.vert4, this.vert4);

        //         let v1_c = this.toCanvas(this.vert1);
        //         let v2_c = this.toCanvas(this.vert2);
        //         let v3_c = this.toCanvas(this.vert3);
        //         let v4_c = this.toCanvas(this.vert4);

        //         // Drawing lines
        //         this.drawLine(v1_c.x, v1_c.y, v2_c.x, v2_c.y);
        //         this.drawLine(v2_c.x, v2_c.y, v3_c.x, v3_c.y);
        //         this.drawLine(v3_c.x, v3_c.y, v4_c.x, v4_c.y);
        //         this.drawLine(v4_c.x, v4_c.y, v1_c.x, v1_c.y);

        //         // // Drawing points for debug
        //         // this.setPixel(v1_c.x, v1_c.y);
        //         // this.setPixel(v2_c.x, v2_c.y);
        //         // this.setPixel(v3_c.x, v3_c.y);
        //         // this.setPixel(v4_c.x, v4_c.y);
        //     }
        // });

        // N-gons
        // Draw models
        this.models.forEach(model => {
            this.camera.viewProjectionMat.copy(this.mvpMat);
            this.mvpMat.multiply(model.mat);

            //model.mat.copy(this.mvpMat);
            //this.mvpMat.multiply(this.camera.viewProjectionMat);

            let face_base = 0;
            for (let face_idx = 0; face_idx < model.num_faces; ++face_idx) {
                let num_verts = model.verts[face_base];

                for (let vert_idx = 0; vert_idx < num_verts - 1; ++vert_idx) {
                    let vert_addr = vert_idx * 3;

                    this.vert1.x = model.verts[face_base + vert_addr + 1];
                    this.vert1.y = model.verts[face_base + vert_addr + 2];
                    this.vert1.z = model.verts[face_base + vert_addr + 3];

                    this.vert2.x = model.verts[face_base + vert_addr + 4];
                    this.vert2.y = model.verts[face_base + vert_addr + 5];
                    this.vert2.z = model.verts[face_base + vert_addr + 6];

                    this.mvpMat.multiplyVec3(this.vert1, this.vert1);
                    this.mvpMat.multiplyVec3(this.vert2, this.vert2);

                    let v1_c = this.toCanvas(this.vert1);
                    let v2_c = this.toCanvas(this.vert2);

                    this.drawLine(v1_c.x, v1_c.y, v2_c.x, v2_c.y);
                }

                this.vert1.x = model.verts[face_base + 1];
                this.vert1.y = model.verts[face_base + 2];
                this.vert1.z = model.verts[face_base + 3];

                this.vert2.x = model.verts[face_base + (num_verts - 1) * 3 + 1];
                this.vert2.y = model.verts[face_base + (num_verts - 1) * 3 + 2];
                this.vert2.z = model.verts[face_base + (num_verts - 1) * 3 + 3];

                this.mvpMat.multiplyVec3(this.vert1, this.vert1);
                this.mvpMat.multiplyVec3(this.vert2, this.vert2);

                let v1_c = this.toCanvas(this.vert1);
                let v2_c = this.toCanvas(this.vert2);

                this.drawLine(v1_c.x, v1_c.y, v2_c.x, v2_c.y);

                face_base += 1 + num_verts * 3;
            }
        });

        // Swap buffers
        this.context.putImageData(this.screenBuffer, 0, 0);
    }

    toCanvas(pos: vec3): vec2 {
        let ret = new vec2();

        ret.x = ((pos.x / pos.z * this.screenWidth / 1.0) + this.screenWidth) / 2.0;
        ret.y = this.screenHeight - ((pos.y / pos.z * this.screenHeight / 1.0) + this.screenHeight) / 2.0;

        return ret;
    }

    setPixel(x: number, y: number) {
        x = Math.floor(x);
        y = Math.floor(y);
        let base = (y * this.screenWidth + x) * 4;

        if (base < 0 || (base + 3) >= (this.screenWidth * this.screenHeight * 4)) {
            return;
        }

        this.screenBuffer.data[base] = this.wireValue;
        this.screenBuffer.data[base + 1] = this.wireValue;
        this.screenBuffer.data[base + 2] = this.wireValue;
        this.screenBuffer.data[base + 3] = 0xFF; // Alpha
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
