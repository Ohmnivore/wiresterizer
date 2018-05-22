class Tween {

    elapsed: number;
    duration: number;
    loopDelay: number;
    callback: ((t: Tween) => void) | null;

    protected table: Float32Array;
    protected tableLength: number;
    protected value: number;

    constructor(table: Float32Array) {
        this.table = table;
        this.tableLength = this.table.length;
        this.value = 0;

        this.elapsed = 0.0;
        this.duration = 0.0;
        this.loopDelay = 0.0;
        this.callback = null;
    }

    protected getCurveApproximation(t: number) {
        let x = t * this.tableLength;

        let x1 = Math.min(this.tableLength - 1, Math.floor(x));
        let y1 = this.table[x1];
        let x2 = Math.min(this.tableLength - 1, Math.ceil(x));
        let y2 = this.table[x2];

        if (x2 == x1) {
            return y1;
        }

        let y = y1 + (x - x1) * (y2 - y1) / (x2 - x1);

        return y;
    }

    start(duration: number, loopDelay: number) {
        this.elapsed = 0.0;

        this.duration = duration;
        this.loopDelay = loopDelay;
    }

    update(elapsed: number) {
        this.elapsed += elapsed;

        if (this.elapsed > this.duration + this.loopDelay) {
            this.elapsed -= this.duration;

            if (this.callback) {
                this.callback(this);
            }
        }

        this.value = this.getCurveApproximation(this.elapsed / this.duration);
    }

    getValue(): number {
        return this.value;
    }
}
