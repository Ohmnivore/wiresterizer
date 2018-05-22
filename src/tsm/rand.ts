class rand {

    static chanceRoll(chance: number): boolean {
        return Math.random() <= chance;
    }

    static floatRanged(min: number, max: number): number {
        return min + Math.random() * (max - min);
    }
}



