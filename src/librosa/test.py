from music import Music
import time

music_names = []
last_input = input()
while last_input != '$':
    music_names.append(last_input)
    last_input = input()

for f in music_names:
    start = time.time()
    music = Music(f'../dataAll/{f}')
    music.do_onset_detection()
    music.do_beat_track()
    music.do_chroma()
    music.do_mfcc()
    h, p = music.hpss()
    h.do_mfcc()
    h.do_chroma()
    p.do_mfcc()
    p.do_chroma()
    music.dump(f'./data-with-hpss-and-mfcc/{f}.json', h, p)
    print(f'File {f} processed in {time.time() - start} seconds.')

