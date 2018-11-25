#pragma once

#include <memory>
#include <string>
#include <vector>

#include <libwebsockets.h>

#include "util.hpp"

namespace LWS {

struct Handler;

struct Dispatcher {
    virtual ~Dispatcher() = default;

    std::vector<struct lws_protocols> protocols;

    struct lws_context *start(int port, const char *iface, unsigned int options);

    virtual std::unique_ptr<Handler> dispatch_http(struct lws *wsi, const char *uri)
        { return nullptr; }
    virtual std::unique_ptr<Handler> dispatch_websocket(struct lws *wsi, const char *uri, const char *protocol)
        { return nullptr; }
};

struct ConnectionData {
    std::unique_ptr<Handler> handler;
    bool is_websocket = false;
};

struct HttpHandler;
struct WebsocketHandler;

struct Handler {
    virtual ~Handler() = default;

    struct lws *wsi;

    virtual HttpHandler *get_http_handler()
        { throw new runtime_error("Not an HTTP handler"); }
    virtual WebsocketHandler *get_websocket_handler()
        { throw new runtime_error("Not a Websocket handler"); }

    void callback_on_writable()
        { lws_callback_on_writable(wsi); }

    bool needClose = false;
};

struct HttpHandler : public Handler {
    virtual void established() { }
    virtual void body(const char *data, size_t len) { }
    virtual void body_completion() { }
    virtual void writable() { }
    virtual void file_completion() { }
    virtual void closed() { }

    HttpHandler *get_http_handler() { return this; }
};

struct WebsocketHandler : public Handler {
    virtual void established() { }
    virtual void data(const char *data, size_t len) { }
    virtual void writable() { }
    virtual void closed() { }

    void write(std::vector<unsigned char> &send_buf, const std::string &data,
               enum lws_write_protocol wp = LWS_WRITE_TEXT) {
        write(send_buf, data.data(), data.size(), wp);
    }

    template <typename T>
    void write(std::vector<unsigned char> &send_buf, const std::vector<T> &data,
               enum lws_write_protocol wp = LWS_WRITE_TEXT) {
        write(send_buf, data.data(), data.size(), wp);
    }

    template <typename T>
    void write(std::vector<unsigned char> &send_buf, const T *data,
               size_t count, enum lws_write_protocol wp = LWS_WRITE_TEXT) {
        auto bytelen = count * sizeof(T);
        send_buf.reserve(LWS_PRE + bytelen);
        memcpy(send_buf.data() + LWS_PRE, data, bytelen);
        lws_write(wsi, send_buf.data() + LWS_PRE, bytelen, wp);
    }

    WebsocketHandler *get_websocket_handler() { return this; }
};

};
