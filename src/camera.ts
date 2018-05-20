class WireCamera {

    public projectionMat: mat4;
    public viewMat: mat4;
    public viewProjectionMat: mat4;

    public position: vec3;
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
        this.direction = new vec3();
        this.target = new vec3();
        this.useDirection = true;
    }

    public setPerspective(fov: number, aspect: number, near: number, far: number) {
        this.projectionMat = mat4.perspective(fov, aspect, near, far);
    }

    public updateCamMats() {
        let target = this.target;
        if (this.useDirection) {
            this.position.copy(target);
            target.add(this.direction);
        }

        this.viewMat = mat4.lookAt(this.position, target, new vec3([0, 1, 0]));

        this.projectionMat.copy(this.viewProjectionMat);
        this.viewProjectionMat.multiply(this.viewMat);
    }
}
