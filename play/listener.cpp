#include <iostream>
#include <stdexcept>
#include <sstream>

#include <vector>
#include <list>
#include <string>

#include <strings.h>
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>

#include <math.h>

#include <ev.h>

#include <jack/jack.h>
#include <jack/ringbuffer.h>

#include <libwebsockets.h>

#include <boost/format.hpp>

#include <nlohmann/json.hpp>
using json = nlohmann::json;

#include "timecode.hpp"
#include "util.hpp"
#include "lws.hpp"
using namespace LWS;

using std::cout;
using std::cerr;
using fmt = boost::format;

std::list<struct TimecodeHandler *> timecode_clients;

struct TimecodeHandler : public WebsocketHandler {
    decltype(timecode_clients)::const_iterator iter;
    std::list<std::string> queue;
    std::vector<unsigned char> send_buf;

    void established() {
        timecode_clients.push_front(this);
        iter = timecode_clients.begin();
    }
    void writable() {
        if (!queue.empty()) {
            write(send_buf, queue.front());
            queue.pop_front();
            if (!queue.empty())
                callback_on_writable();
        }
    }
    void closed() {
        timecode_clients.erase(iter);
    }
};

std::list<struct RawdataHandler *> rawdata_clients;

struct RawdataHandler : public WebsocketHandler {
    decltype(rawdata_clients)::const_iterator iter;
    std::list<std::shared_ptr<std::vector<jack_default_audio_sample_t>>> queue;
    std::vector<unsigned char> send_buf;

    void established() {
        rawdata_clients.push_front(this);
        iter = rawdata_clients.begin();
    }
    void writable() {
        if (!queue.empty()) {
            write(send_buf, *queue.front(), LWS_WRITE_BINARY);
            queue.pop_front();
            if (!queue.empty())
                callback_on_writable();
        }
    }
    void closed() {
        rawdata_clients.erase(iter);
    }
};

struct got_samples_msg {
    size_t count;
    jack_nframes_t nframes;
    ns_t timestamp;
};

static jack_client_t *client;
static jack_port_t *input_port;
static jack_ringbuffer_t *input_rb;
static int pipefd[2];

static int process(jack_nframes_t nframes, void *arg)
{
    static size_t processed = 0;

    struct got_samples_msg msg = { processed, nframes, get_now() };

    auto in = (jack_default_audio_sample_t *)jack_port_get_buffer(input_port, nframes);
    if (in == 0)
        exit(2);

    size_t wrote = jack_ringbuffer_write(input_rb, (const char *)in, sizeof(*in) * nframes);
    if (wrote < sizeof(*in) * nframes) {
        cerr << fmt("overrrun (only wrote %1%)!\n") % wrote;
        exit(1);
    }

    processed += nframes;
    if (write(pipefd[1], &msg, sizeof(msg)) != sizeof(msg)) {
        cerr << "short write to pipe\n";
        exit(1);
    }

    return 0;
}

static void jack_shutdown(void *arg)
{
    cout << "jack_shutdown\n";
    exit(1);
}

TimecodeDecoder decoder;

static void jack_init()
{
    if ((client = jack_client_open("jack-test", JackNullOption, NULL)) == 0) {
        fprintf(stderr, "JACK server not running?\n");
        exit(1);
    }

    input_rb = jack_ringbuffer_create(sizeof(jack_default_audio_sample_t) * 163840);
    printf("%p\n", input_rb);

    jack_set_process_callback(client, process, NULL);
    jack_on_shutdown(client, jack_shutdown, NULL);

    if ((input_port = jack_port_register(client, "input1", JACK_DEFAULT_AUDIO_TYPE, JackPortIsInput, 0)) == 0) {
        fprintf(stderr, "cannot register input port!\n");
        jack_client_close(client);
        exit(1);
    }
    fprintf(stderr, "input_port = %p %s\n", input_port, jack_port_name(input_port));

    if (jack_activate(client)) {
        fprintf (stderr, "cannot activate client");
    }

    if (jack_connect(client, "system:capture_1", jack_port_name(input_port))) {
        fprintf(stderr, "cannot connect capture port\n");
        jack_client_close(client);
        exit(1);
    }
}

static void pipe_cb(struct ev_loop *loop, ev_io *w, int revents)
{
    static std::vector<jack_default_audio_sample_t> buf;

    struct got_samples_msg msg;

    if (read(pipefd[0], &msg, sizeof(msg)) != sizeof(msg))
        throw new runtime_error("bad pipe read");

    buf.reserve(msg.nframes);
    size_t read_size = msg.nframes * sizeof(buf[0]);
    if (jack_ringbuffer_read(input_rb, (char *)buf.data(), read_size) != read_size)
        throw new runtime_error("bad ringbuffer read");

    if (!rawdata_clients.empty()) {
        auto rawdata_buf = std::make_shared<std::vector<jack_default_audio_sample_t>>(msg.nframes);
        std::copy_n(buf.begin(), msg.nframes, rawdata_buf->begin());
        for (auto &c: rawdata_clients) {
            c->queue.push_back(rawdata_buf);
            c->callback_on_writable();
        }
    }

    // std::cout << fmt("%d %d %d %f\n") % msg.count % msg.nframes % msg.timestamp % buf[0];
    // machine.process(msg.count, msg.nframes, msg.timestamp, buf.data());
    decoder.add_samples(buf.data(), buf.data() + msg.nframes);
    while (decoder.has_timecode()) {
        auto timecode = decoder.next_timecode();

        ns_t sample_diff = timecode.index - msg.count;
        ns_t ns_diff = sample_diff * second / 48000;

        json v;
        v["program"] = timecode.program;
        v["track"] = timecode.track;
        v["time"] = (fmt("%d") % ((ns_t)timecode.time_raw * (second / 4))).str();
        v["sync_sample"] = (double)timecode.index;
        v["sync"] = (fmt("%d") % (msg.timestamp + ns_diff)).str();
        v["timestamp_sample"] = (double)msg.count;
        v["timestamp"] = (fmt("%d") % msg.timestamp).str();
        std::string s = v.dump(4);
        for (auto &c: timecode_clients) {
            c->queue.push_back(s);
            c->callback_on_writable();
        }
    }
}

struct ListenerDispatcher : public Dispatcher {
    std::unique_ptr<Handler> dispatch_websocket(struct lws *wsi, const char *uri, const char *protocol) {
        using namespace std::string_literals;

        if ("/timecode"s == uri)
            return std::make_unique<TimecodeHandler>();
        if ("/rawdata"s == uri)
            return std::make_unique<RawdataHandler>();
        return nullptr;
    }
};

int main(int argc, char **argv)
{
    pipe(pipefd);
    fcntl(pipefd[1], F_SETFL, O_NONBLOCK);

    jack_init();

    auto loop = ev_default_loop(0);

    ListenerDispatcher dispatcher;
    auto context = dispatcher.start(9000, nullptr, LWS_SERVER_OPTION_LIBEV);
    lws_ev_initloop(context, loop, 0);

    ev_io pipe_w;
    ev_io_init(&pipe_w, pipe_cb, pipefd[0], EV_READ);
    ev_io_start(loop, &pipe_w);

    ev_run(loop);
}


