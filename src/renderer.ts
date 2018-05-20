class WireRenderer {

    // Update timer
    updateRate: number;
    protected updateInterval: number;
    protected lastTS: number;

    // UI
    protected canvas: HTMLCanvasElement;
    protected context: CanvasRenderingContext2D;
    protected screenBuffer: ImageData;

    protected screenWidth: number;
    protected screenHeight: number;
    protected bgValue: number;
    protected wireValue: number;

    public models: WireModel[];

    constructor(canvas: HTMLCanvasElement, updateRate: number, bgValue: number, wireValue: number) {
        this.canvas = canvas;
        this.screenWidth = canvas.width;
        this.screenHeight = canvas.height;
        this.context = canvas.getContext("2d") as CanvasRenderingContext2D;
        this.screenBuffer = this.context.createImageData(canvas.width, canvas.height);

        this.bgValue = bgValue;
        this.wireValue = wireValue;

        this.updateRate = updateRate;
        this.updateInterval = 0.0;
        this.lastTS = 0.0;

        this.models = [];

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

        this.models.forEach(model => {
            for (let face_idx = 0; face_idx < model.num_faces; ++face_idx) {
                let face_base = (face_idx << 2);

                let vert1_x = model.verts[face_base];
                let vert1_y = model.verts[face_base +  1];
                let vert1_z = model.verts[face_base +  2];

                let vert2_x = model.verts[face_base +  3];
                let vert2_y = model.verts[face_base +  4];
                let vert2_z = model.verts[face_base +  5];

                let vert3_x = model.verts[face_base +  6];
                let vert3_y = model.verts[face_base +  7];
                let vert3_z = model.verts[face_base +  8];

                let vert4_x = model.verts[face_base +  9];
                let vert4_y = model.verts[face_base + 10];
                let vert4_z = model.verts[face_base + 11];
            }
        });

        // Swap buffers
        this.context.putImageData(this.screenBuffer, 0, 0);
    }
}
