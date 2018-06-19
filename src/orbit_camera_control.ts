class WireOrbitCameraControl {

    private cam: WireCamera;
    private distance: number;
    private focus: vec3;
    private canvas: HTMLCanvasElement;

    private mousePressed: boolean;

    private zoom: number;

    private lastX: number | null;
    private curX: number | null;
    private rotX: number;
    private rotMultiplier: number;

    private lastY: number | null;
    private curY: number | null;
    private rotY: number;

    constructor(cam: WireCamera, distance: number, focus: vec3, canvas: HTMLCanvasElement) {
        this.cam = cam;
        this.distance = distance;
        this.focus = focus;
        this.canvas = canvas;

        this.mousePressed = false;

        this.zoom = 1.0;

        this.lastX = null;
        this.curX = null;
        this.rotX = -Math.PI / 4.0;
        this.rotMultiplier = 8.0;

        this.lastY = null;
        this.curY = null;
        this.rotY = Math.PI / 8.0;

        this.cam.useDirection = false;

        document.addEventListener("mousedown", (e: MouseEvent) => this.mouseDownHandler(e), false);
        document.addEventListener("mouseup", (e: MouseEvent) => this.mouseUpHandler(e), false);
        document.addEventListener("mousemove", (e: MouseEvent) => this.mouseMoveHandler(e), false);
        document.addEventListener("wheel", (e: MouseWheelEvent) => this.mouseWheelHandler(e), false);
    }

    public setZoom(zoom: number) {
        this.zoom = Math.max(0.05, zoom);
    }

    update(elapsed: number) {
        let dX: number = 0.0;
        if (this.curX != null) {
            if (this.lastX != null) {
                dX = this.curX - this.lastX;
            }
            this.lastX = this.curX;
        }

        let dY: number = 0.0;
        if (this.curY != null) {
            if (this.lastY != null) {
                dY = this.curY - this.lastY;
            }
            this.lastY = this.curY;
        }

        if (this.mousePressed) {
            this.rotX += dX / this.canvas.width * this.rotMultiplier;
            this.rotY += dY / this.canvas.height * this.rotMultiplier;

            this.rotY = Math.min(Math.PI / 2.0 * 0.9, this.rotY);
            this.rotY = Math.max(-Math.PI / 2.0 * 0.9, this.rotY);
        }

        this.cam.target.copyFrom(this.focus);

        this.cam.position.y = Math.sin(this.rotY) * this.distance * this.zoom;
        this.cam.position.z = Math.cos(this.rotY) * this.distance * this.zoom;

        this.cam.position.x = Math.cos(this.rotX + Math.PI / 2.0) * this.cam.position.z;
        this.cam.position.z = Math.sin(this.rotX + Math.PI / 2.0) * this.cam.position.z;
    }

    private mouseDownHandler(e: MouseEvent) {
        let relativeX = e.clientX - this.canvas.offsetLeft;
        let relativeY = e.clientY - this.canvas.offsetTop;

        if (relativeX > 0 && relativeX < this.canvas.width &&
            relativeY > 0 && relativeY < this.canvas.height) {
            this.mousePressed = true;
        }
    }

    private mouseUpHandler(e: MouseEvent) {
        this.mousePressed = false;
    }

    private mouseMoveHandler(e: MouseEvent) {
        let relativeX = e.clientX - this.canvas.offsetLeft;
        let relativeY = e.clientY - this.canvas.offsetTop;

        if ((relativeX > 0 && relativeX < this.canvas.width) || this.mousePressed) {
            this.curX = relativeX;
        }

        if ((relativeY > 0 && relativeY < this.canvas.height) || this.mousePressed) {
            this.curY = relativeY;
        }
    }


    private mouseWheelHandler(e: MouseWheelEvent) {
        let relativeX = e.clientX - this.canvas.offsetLeft;
        let relativeY = e.clientY - this.canvas.offsetTop;

        if (this.mousePressed || (relativeX > 0 && relativeX < this.canvas.width &&
            relativeY > 0 && relativeY < this.canvas.height)) {
            if (e.deltaY != 0.0) {
                let incr = e.deltaY / Math.abs(e.deltaY) * 0.1;
                this.setZoom(this.zoom + incr);
            }
        }
    }
}
