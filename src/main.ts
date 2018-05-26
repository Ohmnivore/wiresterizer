// Ugly hack to force early math classes declaration
/// <reference path="tsm/tsm.ts"/>

// Ugly hack to force early Renderer class declaration
/// <reference path="renderer.ts"/>

// Ugly hack to force early Model class declaration
/// <reference path="model.ts"/>

// Ugly hack to force early Tween class declaration
/// <reference path="tween.ts"/>

// Ugly hack to force early model array declaration
/// <reference path="cube.ts"/>


// Init variables
let canvasID = "wiresterizer";
let frameRate = 60.0;
let bgValue = 0x00000000;     // transparent
let wireValue = 0xFFFFFFFF;   // solid white + endianness doesn't matter (we're using typed arrays for the screen buffer)
let fov = 45.0;
let near = 0.01;
let far = 10000.0;


class LogoScene extends WireRenderer {

    tweens: Tween[];
    rotationTween: Tween;
    tiltTween: Tween;

    private turnLeft: boolean;
    private tiltUp: boolean;

    constructor() {
        let canvas = element(canvasID) as HTMLCanvasElement;
        super(canvas, frameRate, bgValue, wireValue);

        // Setup scene (-Z forward, Y up)
        this.camera.setPerspective(fov, this.screenAspectRatio, near, far);

        this.camera.position.x = 0.0;
        this.camera.position.y = -0.2;
        this.camera.position.z = 3.0;

        this.camera.target.x = 0.0;
        this.camera.target.y = -0.2;
        this.camera.target.z = 0.0;

        this.camera.useDirection = false;

        let cube = new WireModel(array_cube)
        this.models.push(cube)

        cube.pos.x = 0;
        cube.pos.y = 0;
        cube.pos.z = 0;
        cube.updateMat();


        // Setup tweens
        this.tweens = []

        this.rotationTween = new Tween(array_curve_rotation);
        this.tweens.push(this.rotationTween);
        this.rotationTween.start(2.0, 1.0);
        this.rotationTween.callback = ((t: Tween) => this.finishedRotation(t));

        this.tiltTween = new Tween(array_curve_rotation);
        this.tweens.push(this.tiltTween);
        this.tiltTween.start(3.0, 0.0);
        this.tiltTween.callback = ((t: Tween) => this.finishedTilt(t));

        this.turnLeft = false;
        this.tiltUp = false;
    }

    update(elapsed: number) {
        // Use rotation tween
        let rotationValue = this.rotationTween.getValue();
        let rotationAngle;
        if (this.turnLeft) {
            rotationAngle = rotationValue * 2.0 * Math.PI;
        }
        else {
            rotationAngle = (1.0 - rotationValue) * 2.0 * Math.PI;
        }
        let x = Math.sin(rotationAngle);
        let z = Math.cos(rotationAngle);
        this.camera.position.x = x * 3.0;
        this.camera.position.z = z * 3.0;

        // Use tilt tween
        let tiltValue = this.tiltTween.getValue();
        let tiltAngle;
        let y;
        if (this.tiltUp) {
            tiltAngle = (1.0 - tiltValue) * 2.0 * Math.PI;
            y = (Math.sin(tiltAngle) - 0.25) * 2.5;
            // This is actually the same thing as the else branch, for the time being
            // It just looks better that way. Tweens will be reworked anyway.
        }
        else {
            tiltAngle = (1.0 - tiltValue) * 2.0 * Math.PI;
            y = (Math.sin(tiltAngle) - 0.25) * 2.5;
        }
        this.camera.position.y = y;

        // Update tweens
        for (let idx = 0; idx < this.tweens.length; ++idx) {
            this.tweens[idx].update(elapsed);
        }

        super.update(elapsed);
    }

    finishedRotation(t: Tween) {
        t.start(rand.floatRanged(1.0, 3.0), rand.floatRanged(0.0, 0.75));
        this.turnLeft = rand.chanceRoll(0.4);
    }

    finishedTilt(t: Tween) {
        t.start(rand.floatRanged(3.0, 5.0), rand.floatRanged(0.0, 0.75));
        this.tiltUp = rand.chanceRoll(0.36);
    }
}


// Create renderer
let renderer = new LogoScene();


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
