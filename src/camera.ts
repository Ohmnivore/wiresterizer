class WireCamera {

    public projectionMat: mat4;
    public viewMat: mat4;
    public viewProjectionMat: mat4;

    public position: vec3;
    public up: vec3;
    public direction: vec3;
    public target: vec3;
    public useDirection: boolean;

    public constructor() {
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

    public setPerspective(fov: number, aspect: number, near: number, far: number) {
        mat4.perspective(fov, aspect, near, far, this.projectionMat);
    }

    public updateCamMats() {
        let target = this.target;
        if (this.useDirection) {
            this.position.copyTo(target);
            target.add(this.direction);
        }

        mat4.lookAt(this.position, target, this.viewMat, this.up);

        this.projectionMat.copyTo(this.viewProjectionMat);
        this.viewProjectionMat.multiply(this.viewMat);
    }
}
