class WireCamera {

    projectionMat: mat4;
    viewMat: mat4;
    viewProjectionMat: mat4;

    position: vec3;
    up: vec3;
    direction: vec3;
    target: vec3;
    useDirection: boolean;

    constructor() {
        this.projectionMat = new mat4();
        this.projectionMat.setIdentity();
        this.viewMat = new mat4();
        this.viewMat.setIdentity();
        this.viewProjectionMat = new mat4();
        this.viewProjectionMat.setIdentity();

        this.position = new vec3();
        this.up = new vec3([0, 1, 0]);
        this.direction = new vec3();
        this.target = new vec3();
        this.useDirection = true;
    }

    setPerspective(fov: number, aspect: number, near: number, far: number) {
        mat4.perspective(fov, aspect, near, far, this.projectionMat);
    }

    updateCamMats() {
        let target = this.target;
        if (this.useDirection) {
            this.target.copyFrom(this.position);
            target.add(this.direction);
        }

        mat4.lookAt(this.position, target, this.viewMat, this.up);

        this.viewProjectionMat.copyFrom(this.projectionMat);
        this.viewProjectionMat.multiply(this.viewMat);
    }
}
