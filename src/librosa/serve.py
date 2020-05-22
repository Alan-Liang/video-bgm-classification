from music import Music
import socketserver
import time
import sys

PORT = int(sys.argv[1])

def process(f):
    start = time.time()
    music = Music(f)
    music.do_onset_detection()
    music.do_beat_track()
    music.do_chroma()
    music.do_viterbi()
    save_file = f'{f}.json'
    music.dump(save_file)
    return f'{save_file}|{time.time() - start}'

class ReusableTcpServer(socketserver.TCPServer):
    allow_reuse_address = True

class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        data = ''
        while True:
            (recv, _, _, _) = self.request.recvmsg(4096)
            data = data + recv.decode()
            if data.endswith('\n'): break
        try:
            self.request.send(('200|' + process(data.replace('\n', '').replace('\r', ''))).encode())
        except FileNotFoundError as _:
            self.request.send(b'404||')
        except Exception as e:
            print(e)
            self.request.send((f'500|{e}|').encode())
        self.request.close()

with ReusableTcpServer(('127.0.0.1', PORT), Handler) as server:
    server.serve_forever()
