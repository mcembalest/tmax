"""Record a real Herdr client as asciicast v2. Run with uv; no dependencies."""
import codecs
import fcntl
import json
import os
import pty
import select
import signal
import struct
import sys
import termios
import time

output = sys.argv[1]
pid, terminal = pty.fork()
if pid == 0:
    os.execvp("herdr", ["herdr"])
fcntl.ioctl(terminal, termios.TIOCSWINSZ, struct.pack("HHHH", 48, 160, 0, 0))
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
decoder = codecs.getincrementaldecoder("utf-8")("replace")
start = time.monotonic()
try:
    with open(output, "w") as recording:
        recording.write(json.dumps({"version": 2, "width": 160, "height": 48,
                                   "title": "tmax: one conversation, living views",
                                   "env": {"TERM": "xterm-256color"}}) + "\n")
        while True:
            if select.select([terminal], [], [], 0.1)[0]:
                data = os.read(terminal, 65536)
                if not data:
                    break
                recording.write(json.dumps([round(time.monotonic() - start, 4), "o", decoder.decode(data)]) + "\n")
                recording.flush()
except OSError:
    pass
finally:
    os.close(terminal)
    # End only this disposable recording client; the isolated server is closed
    # separately by the demo fixture. Herdr may ignore SIGHUP while attached.
    os.kill(pid, signal.SIGKILL)
    os.waitpid(pid, 0)
