const fs = require("fs");

class Oscillator {
	sampleRate = 44100;
	bitDepth = 16;
	angle = 0.0;
	offset = 0.0;
	constructor(freq, amp) {
		this.freq = freq;
		this.amp = amp;
	}
	exportWav(path) {
		fs.writeFileSync(path, "");
		function rein(value, size) {
			let i = new Uint16Array(size / 2);
			i[0] = value;
			return Buffer.copyBytesFrom(i);
		}
		function rein32(value, size) {
			let i = new Uint32Array(size / 4);
			i[0] = value;
			return Buffer.copyBytesFrom(i);
		}
		let buf = this.createBuffer(2);
		let file = fs.createWriteStream(path);
		file.write("RIFF");
		file.write("----");
		file.write("WAVE");
		file.write("fmt ");
		file.write(rein(16, 4)); // Size
		file.write(rein(1, 2)); // Compression code
		file.write(rein(1, 2)); // Number of channels
		file.write(rein32(this.sampleRate, 4));
		file.write(rein32((this.sampleRate * this.bitDepth) / 8, 4));
		file.write(rein(this.bitDepth / 8, 2)); // Block align
		file.write(rein(this.bitDepth, 2)); // Bit depth

		file.write("data");
		file.write(rein32(buf.length, 4));
		file.write(buf);
		file.close();
		file = fs.createWriteStream(path, { start: 4 });
		file.write(rein32(fs.readFileSync(path).byteLength - 8, 6));
		file.close();
	}
}

class SineOscillator extends Oscillator {
	constructor(freq, amp) {
		super(freq, amp);
		this.offset = (2 * Math.PI * freq) / this.sampleRate;
	}
	steppedSample(modifier) {
		modifier =
			modifier ||
			function (s) {
				return s;
			};
		let sample = this.amp * Math.sin(this.angle);
		this.angle += this.offset;
		return modifier(sample);
	}
	createBuffer(duration, modifier) {
		let maxAmp = Math.pow(2, this.bitDepth - 1) - 1;
		let f = new Uint16Array(this.sampleRate * duration);
		for (let i = 0; i < this.sampleRate * duration; i++) {
			let sample = this.steppedSample(modifier);
			let intSample = sample * maxAmp;
			f[i] = intSample;
		}
		return Buffer.copyBytesFrom(f);
	}
}

class SawOscillator extends Oscillator {
	constructor(freq, amp) {
		super(freq, amp);
		this.offset = 1 / this.sampleRate;
	}
	steppedSample(modifier) {
		modifier =
			modifier ||
			function (s) {
				return s;
			};
		let sample = 2 * this.amp * this.freq * (this.angle % (1 / this.freq)) - this.amp;
		this.angle += this.offset;
		return modifier(sample);
	}
	createBuffer(duration, modifier) {
		let maxAmp = Math.pow(2, this.bitDepth - 1) - 1;
		let f = new Uint16Array(this.sampleRate * duration);
		for (let i = 0; i < this.sampleRate * duration; i++) {
			let sample = this.steppedSample(modifier);
			let intSample = sample * maxAmp;
			f[i] = intSample;
		}
		return Buffer.copyBytesFrom(f);
	}
}

class SquareOscillator extends SineOscillator {
	constructor(freq, amp) {
		super(freq, amp);
	}
	steppedSample(modifier) {
		modifier =
			modifier ||
			function (s) {
				return s;
			};
		let sample = Math.sign((this.amp * Math.sin(this.angle)) / this.amp) * this.amp;
		this.angle += this.offset;
		return modifier(sample);
	}
	createBuffer(duration, modifier) {
		let maxAmp = Math.pow(2, this.bitDepth - 1) - 1;
		let f = new Uint16Array(this.sampleRate * duration);
		for (let i = 0; i < this.sampleRate * duration; i++) {
			let sample = this.steppedSample(modifier);
			let intSample = sample * maxAmp;
			f[i] = intSample;
		}
		return Buffer.copyBytesFrom(f);
	}
}

class TriangleOscillator extends Oscillator {
	constructor(freq, amp) {
		super(freq, amp);
		this.offset = freq / this.sampleRate;
	}
	steppedSample(modifier) {
		modifier =
			modifier ||
			function (s) {
				return s;
			};
		let sample = 4 * this.amp * Math.abs(this.angle - Math.floor(this.angle + 0.5)) - this.amp;
		this.angle += this.offset;
		return modifier(sample);
	}
	createBuffer(duration, modifier) {
		let maxAmp = Math.pow(2, this.bitDepth - 1) - 1;
		let f = new Uint16Array(this.sampleRate * duration);
		for (let i = 0; i < this.sampleRate * duration; i++) {
			let sample = this.steppedSample(modifier);
			let intSample = sample * maxAmp;
			f[i] = intSample;
		}
		return Buffer.copyBytesFrom(f);
	}
}

class Note {
	#A4 = 440;
	#scales = {
		"A#": {
			alias: ["Bb"],
			fromA: 1,
		},
		B: {
			alias: ["Cb"],
			fromA: 2,
		},
		C: {
			alias: ["B#"],
			fromA: 3,
		},
		"C#": {
			alias: ["Db"],
			fromA: 4,
		},
		D: {
			alias: [],
			fromA: 5,
		},
		"D#": {
			alias: ["Eb"],
			fromA: 6,
		},
		E: {
			alias: ["Fb"],
			fromA: 7,
		},
		F: {
			alias: ["E#"],
			fromA: 8,
		},
		"F#": {
			alias: ["Gb"],
			fromA: 9,
		},
		G: {
			alias: [],
			fromA: 10,
		},
		"G#": {
			alias: ["Ab"],
			fromA: 11,
		},
		A: {
			alias: [],
			fromA: 0,
		},
	};
	/**
	 *
	 * @param {string} id
	 * @param {number?} A4
	 */
	constructor(id, A4) {
		this.#A4 = A4 || 440;
		const split = id.match(new RegExp(/\d+$/))?.index || null,
			note = id.slice(0, split),
			mult = parseInt(id.slice(split)),
			n = -48 + this.#scales[note].fromA + mult * 12;
		this.freq = Math.pow(2, n / 12) * this.#A4;
		this.note = id;
	}
}

// Sine
(() => {
	new TriangleOscillator(new Note("E2").freq, 0.3).exportWav("triangle.wav");
})();
console.log("Done!");
