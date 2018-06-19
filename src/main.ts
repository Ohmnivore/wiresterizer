// Ugly hack to force early math classes declaration
/// <reference path="tsm/tsm.ts"/>

// Ugly hack to force early Renderer class declaration
/// <reference path="renderer.ts"/>

// Ugly hack to force early WebGLRenderer class declaration
/// <reference path="webgl_renderer.ts"/>

// Ugly hack to force early Model class declaration
/// <reference path="model.ts"/>

// Ugly hack to force early Tween class declaration
/// <reference path="tween.ts"/>


// Init variables
let canvasID = "wiresterizer";
let frameRate = 60.0;
let bgValue = 0x00000000;     // transparent
let wireValue = 0xFFFFFFFF;   // solid white + endianness doesn't matter (we're using typed arrays for the screen buffer)
let fov = 45.0;
let near = 0.01;
let far = 10000.0;


class LogoScene {

    renderer: any; // WireWebGLRenderer or WireRenderer (canvas fallback)

    constructor() {
        let canvas = element(canvasID) as HTMLCanvasElement;

        // Launch WebGL or canvas renderer
        this.renderer = new WireWebGLRenderer(canvas, frameRate, bgValue, wireValue);
        if (!this.renderer.isSupportedOnBrowser()) {
            let clonedCanvas = canvas.cloneNode() as HTMLCanvasElement;
            let parent = canvas.parentNode as Node;
            parent.removeChild(canvas);
            parent.appendChild(clonedCanvas);
            this.renderer = new WireRenderer(clonedCanvas, frameRate, bgValue, wireValue);
        }
        this.renderer.preUpdate = (elapsed: number) => this.preUpdate(elapsed);
        this.renderer.launch();

        // Setup scene (-Z forward, Y up)
        this.renderer.camera.setPerspective(fov, this.renderer.screenAspectRatio, near, far);

        this.renderer.camera.position.x = 0.0;
        this.renderer.camera.position.y = -0.2;
        this.renderer.camera.position.z = 8.0;

        this.renderer.camera.target.x = 0.0;
        this.renderer.camera.target.y = -0.2;
        this.renderer.camera.target.z = 0.0;

        this.renderer.camera.useDirection = false;

        // let cube = new WireModel(array_cube)
        // this.renderer.models.push(cube)

        // cube.pos.x = 0;
        // cube.pos.y = -1.75;
        // cube.pos.z = 0;
        // cube.updateMat();
    }

    preUpdate(elapsed: number) {
        
    }
}


// Create scene
let scene = new LogoScene();


///////////////////////////////////////////////////////////////////////////////
// HTML Helpers

function element(id: string): HTMLElement {
    let ret = document.getElementById(id);
    if (ret == undefined) {
        alert("Element with ID " + id + " not found.");
        return new HTMLElement(); // Tricking TypeScript's strict null check
    }
    else {
        return ret;
    }
}


///////////////////////////////////////////////////////////////////////////////
// Polyfills

let ArrayProto: any = Array.prototype;

// Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill
if (!ArrayProto.fill) {
    Object.defineProperty(Array.prototype, 'fill', {
        value: function(value: any) {
            // Steps 1-2.
            if (this == null) {
                throw new TypeError('this is null or not defined');
            }

            var O = Object(this);

            // Steps 3-5.
            var len = O.length >>> 0;

            // Steps 6-7.
            var start = arguments[1];
            var relativeStart = start >> 0;

            // Step 8.
            var k = relativeStart < 0 ?
            Math.max(len + relativeStart, 0) :
            Math.min(relativeStart, len);

            // Steps 9-10.
            var end = arguments[2];
            var relativeEnd = end === undefined ?
            len : end >> 0;

            // Step 11.
            var final = relativeEnd < 0 ?
            Math.max(len + relativeEnd, 0) :
            Math.min(relativeEnd, len);

            // Step 12.
            while (k < final) {
                O[k] = value;
                k++;
            }

            // Step 13.
            return O;
        }
    });
}

if (!Uint8Array.prototype.fill) {
    Uint8Array.prototype.fill = ArrayProto.fill;
}

if (!Uint32Array.prototype.fill) {
    Uint32Array.prototype.fill = ArrayProto.fill;
}
