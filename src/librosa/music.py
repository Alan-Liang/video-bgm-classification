import librosa
import numpy as np
import json
import time

__version__ = 2
__authors__ = ['Alan-Liang']


def maybe_array_from_maybe_ndarray(ndarray):
    if ndarray is not None:
        return ndarray.tolist()
    return ndarray


class Music:
    def __init__(self, filename):
        start = time.time()
        self.filename = filename
        self.y, self.sr = librosa.load(filename)
        self.mfcc = self.onset_envelope = self.onset_frames = self.tempo = self.beats = self.recurrence_matrix = None
        self.chroma = self.viterbi = None  # PEP 8: line too long
        print(f'File {filename} loaded in {time.time() - start} seconds.')

    def dump(self, filename):
        start = time.time()
        with open(filename, 'w') as f:
            json.dump({
                'filename': self.filename,
                # 'y': maybe_array_from_maybe_ndarray(self.y),
                'sr': self.sr,
                # 'mfcc': maybe_array_from_maybe_ndarray(self.mfcc),
                'onsetEnvelope': maybe_array_from_maybe_ndarray(self.onset_envelope),
                'onsetFrames': maybe_array_from_maybe_ndarray(self.onset_frames),
                'tempo': self.tempo,
                'beats': maybe_array_from_maybe_ndarray(self.beats),
                # 'recurrence_matrix': maybe_array_from_maybe_ndarray(self.recurrence_matrix),
                'chroma': maybe_array_from_maybe_ndarray(self.chroma),
                'viterbi': maybe_array_from_maybe_ndarray(self.viterbi),
            }, f)
        print(f'File {self.filename} saved to {filename} in {time.time() - start} seconds.')

    def do_mfcc(self):
        start = time.time()
        self.mfcc = librosa.feature.mfcc(y=self.y, sr=self.sr)
        print(f'MFCC done for {self.filename} in {time.time() - start} seconds.')

    def do_onset_detection(self):
        start = time.time()
        self.onset_envelope = librosa.onset.onset_strength(y=self.y, sr=self.sr)
        self.onset_frames = librosa.onset.onset_detect(onset_envelope=self.onset_envelope, sr=self.sr)
        print(f'Onset detection done for {self.filename} in {time.time() - start} seconds.')

    def do_beat_track(self):
        start = time.time()
        if self.onset_envelope is None:
            print('Beat track requires onset envelope which is not present, calling do_onset_detection.')
            self.do_onset_detection()
        self.tempo, self.beats = librosa.beat.beat_track(onset_envelope=self.onset_envelope, sr=self.sr)
        print(f'Beat track done for {self.filename} in {time.time() - start} seconds.')

    def do_recurrence_matrix(self):
        start = time.time()
        if self.mfcc is None:
            print('Recurrence matrix requires MFCC which is not present, calling do_mfcc.')
            self.do_mfcc()
        self.recurrence_matrix = librosa.segment.recurrence_matrix(self.mfcc)
        print(f'Recurrence matrix done for {self.filename} in {time.time() - start} seconds.')

    def do_chroma(self):
        start = time.time()
        self.chroma = librosa.feature.chroma_stft(y=self.y, sr=self.sr)
        print(f'Chroma done for {self.filename} in {time.time() - start} seconds.')

    def do_viterbi(self):
        start = time.time()
        rms = librosa.feature.rms(y=self.y)[0]
        r_normalized = (rms - 0.02) / np.std(rms)
        p = np.exp(r_normalized) / (1 + np.exp(r_normalized))
        self.viterbi = librosa.sequence.viterbi_discriminative(np.vstack([1 - p, p]), librosa.sequence.transition_loop(2, [0.5, 0.6]))
        print(f'Viterbi done for {self.filename} in {time.time() - start} seconds.')

if __name__ == '__main__':
    music = Music(input('infile = '))
    music.do_mfcc()
    music.do_onset_detection()
    music.do_beat_track()
    music.do_chroma()
    music.do_viterbi()
    # music.do_recurrence_matrix()
    music.dump(input('outfile = '))
