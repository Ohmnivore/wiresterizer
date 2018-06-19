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

// Ugly hack to force early OrbitCamControl class declaration
/// <reference path="orbit_camera_control.ts"/>

// Ugly hack to force early model declaration
/// <reference path="models/air_balloon.ts"/>
/// <reference path="models/controller.ts"/>
/// <reference path="models/logo.ts"/>
/// <reference path="models/race_car.ts"/>
/// <reference path="models/sail_ship.ts"/>
/// <reference path="models/space_ship.ts"/>
/// <reference path="models/viking_ship.ts"/>


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
    camControl: WireOrbitCameraControl;
    allModels: WireModel[];

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
        this.camControl = new WireOrbitCameraControl(this.renderer.camera, 24.0, new vec3([0.0, 0.0, 0.0]), this.renderer.canvas);

        this.allModels = [];
        
        let sources = [
            array_air_balloon,
            array_controller,
            array_logo,
            array_race_car,
            array_sail_ship,
            array_space_ship,
            array_viking_ship
        ];

        for (let idx = 0; idx < sources.length; ++idx) {
            let model = new WireModel(sources[idx]);

            model.pos.x = 0.0;
            model.pos.y = 0.0;
            model.pos.z = 0.0;
            model.updateMat();

            this.allModels.push(model);
        }

        this.renderer.models = [this.allModels[6]];

        let modelDropdown = element("model-dropdown") as HTMLSelectElement;
        modelDropdown.addEventListener("change", (e: Event) => this.onModelSelect(e));
        this.updateModel(modelDropdown.value);

        let zoomSlider = element("zoom-slider") as HTMLInputElement;
        zoomSlider.addEventListener("change", (e: Event) => this.onZoomSlider(e));
        zoomSlider.addEventListener("input", (e: Event) => this.onZoomSlider(e));
        this.updateZoom(zoomSlider.valueAsNumber)
    }

    preUpdate(elapsed: number) {
        this.camControl.update(elapsed);
    }


    private onModelSelect(e: Event) {
        if (e.target != null) {
            let select = e.target as HTMLSelectElement;
            this.updateModel(select.value);
        }
    }

    private updateModel(value: string) {
        if (value == "air_balloon") {
            this.setModelIdx(0);
        }
        else if (value == "controller") {
            this.setModelIdx(1);
        }
        else if (value == "logo") {
            this.setModelIdx(2);
        }
        else if (value == "race_car") {
            this.setModelIdx(3);
        }
        else if (value == "sail_ship") {
            this.setModelIdx(4);
        }
        else if (value == "space_ship") {
            this.setModelIdx(5);
        }
        else if (value == "viking_ship") {
            this.setModelIdx(6);
        }
    }

    private setModelIdx(idx: number) {
        this.renderer.models[0] = this.allModels[idx];
    }


    private onZoomSlider(e: Event) {
        if (e.target != null) {
            let slider = e.target as HTMLInputElement;
            this.updateZoom(slider.valueAsNumber);
        }
    }

    private updateZoom(value: number) {
        value = 1.0 - value / 100.0;
        this.camControl.setZoom(value);
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
