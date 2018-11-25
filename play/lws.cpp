#include <iostream>
#include <boost/format.hpp>

using fmt = boost::format;

#include "lws.hpp"

using namespace LWS;

static int callback_function(struct lws *wsi, enum lws_callback_reasons reason,
                             void *user, void *in, size_t len)
{
    std::cout << fmt("callback_function: %p %d %p\n") % user % reason % user;

    int ret = 0;
    struct lws_context *context = lws_get_context(wsi);
    auto dispatcher = reinterpret_cast<Dispatcher *>(lws_context_user(context));
    auto char_in = reinterpret_cast<char *>(in);
    auto conndata = reinterpret_cast<ConnectionData *>(user);

    switch (reason) {
    case LWS_CALLBACK_OPENSSL_LOAD_EXTRA_CLIENT_VERIFY_CERTS:
    case LWS_CALLBACK_OPENSSL_LOAD_EXTRA_SERVER_VERIFY_CERTS:
    case LWS_CALLBACK_OPENSSL_CONTEXT_REQUIRES_PRIVATE_KEY:
    case LWS_CALLBACK_OPENSSL_PERFORM_CLIENT_CERT_VERIFICATION:
        conndata = nullptr;
        break;
    default:
        break;
    }

    switch (reason) {
    case LWS_CALLBACK_HTTP: {
        auto handler = dispatcher->dispatch_http(wsi, char_in);
        if (!handler)
            return 1;
        handler->wsi = wsi;
        new (conndata) ConnectionData;
        conndata->handler = std::move(handler);
        conndata->handler->get_http_handler()->established();
        if (conndata->handler->needClose) ret = -1;
        break;
    }
    case LWS_CALLBACK_HTTP_BODY:
        conndata->handler->get_http_handler()->body(reinterpret_cast<char *>(in), len);
        if (conndata->handler->needClose) ret = -1;
        break;
    case LWS_CALLBACK_HTTP_BODY_COMPLETION:
        conndata->handler->get_http_handler()->body_completion();
        if (conndata->handler->needClose) ret = -1;
        break;
    case LWS_CALLBACK_HTTP_WRITEABLE:
        conndata->handler->get_http_handler()->writable();
        if (conndata->handler->needClose) ret = -1;
        break;
    case LWS_CALLBACK_HTTP_FILE_COMPLETION:
        conndata->handler->get_http_handler()->file_completion();
        if (conndata->handler->needClose) ret = -1;
        break;

    case LWS_CALLBACK_FILTER_PROTOCOL_CONNECTION: {
        std::vector<char> uri(lws_hdr_total_length(wsi, WSI_TOKEN_GET_URI) + 1);
        lws_hdr_copy(wsi, uri.data(), uri.size(), WSI_TOKEN_GET_URI);
        auto handler = dispatcher->dispatch_websocket(wsi, uri.data(), char_in);
        if (!handler)
            return 1;
        handler->wsi = wsi;
        new (conndata) ConnectionData;
        conndata->handler = std::move(handler);
        conndata->is_websocket = true;
        break;
    }
    case LWS_CALLBACK_ESTABLISHED:
        conndata->handler->get_websocket_handler()->established();
        if (conndata->handler->needClose) ret = -1;
        break;
    case LWS_CALLBACK_RECEIVE:
        conndata->handler->get_websocket_handler()->data(reinterpret_cast<char *>(in), len);
        if (conndata->handler->needClose) ret = -1;
        break;
    case LWS_CALLBACK_SERVER_WRITEABLE:
        conndata->handler->get_websocket_handler()->writable();
        if (conndata->handler->needClose) ret = -1;
        break;

    case LWS_CALLBACK_CLOSED:
    case LWS_CALLBACK_CLOSED_HTTP:
        if (conndata->is_websocket) {
            conndata->handler->get_websocket_handler()->closed();
            if (conndata->handler->needClose) ret = -1;
        } else {
            if (conndata->handler) {
                conndata->handler->get_http_handler()->closed();
                if (conndata->handler->needClose) ret = -1;
            }
        }
        break;

        break;
    case LWS_CALLBACK_WSI_DESTROY: {
        if (user)
            conndata->~ConnectionData();
        break;
    }

    default:
        break;
    }

    

    return ret;
}

struct lws_context *Dispatcher::start(int port, const char *iface, unsigned int options)
{
    struct lws_context_creation_info info = { 0, };

    protocols.clear();
    protocols.push_back({ "default", callback_function, sizeof(ConnectionData), 64 * 1024 });
    protocols.push_back({ 0 });

    info.port = port;
    info.iface = iface;
    info.protocols = protocols.data();
    info.gid = -1;
    info.uid = -1;
    info.options = options;
    info.user = this;

    auto context = lws_create_context(&info);
    if (!context)
        throw new runtime_error("lws init failed");

    return context;
}
