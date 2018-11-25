#pragma once

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>

#include <atomic>

#include <time.h>

#include <exception>
#include <string>
#include <iostream>

struct runtime_error : public std::runtime_error {
    runtime_error(std::string what) : std::runtime_error(what) {
        std::cerr << what << "\n";
    }
};

static inline void pabort(const char *s)
{
    perror(s);
    abort();
}

typedef int64_t ns_t;
#define NS_C(x) INT64_C(x)

typedef int_fast32_t frame_t;
static const frame_t min_frame = INT_FAST32_MIN;
typedef std::atomic<frame_t> atomic_frame_t;

static const ns_t second = NS_C(1000000000);

template<class T, class Compare>
constexpr const T &clamp(const T &v, const T &lo, const T &hi, Compare comp)
{
    return comp(v, lo) ? lo : comp(hi, v) ? hi : v;
}

template<class T>
constexpr const T &clamp(const T &v, const T &lo, const T &hi)
{
    return clamp(v, lo, hi, std::less<>());
}

static inline ns_t get_now()
{
    struct timespec ts;
    ::clock_gettime(CLOCK_REALTIME, &ts);
    return ts.tv_sec * second + ts.tv_nsec;
}

static inline struct timespec timespec_from(ns_t ns)
{
    struct timespec ts = {
        (long)(ns / second),
        (long)(ns % second),
    };
    return ts;
}

struct rgba_t {
    rgba_t() : r(0), g(0), b(0), a(255) { }
    rgba_t(uint8_t rr, uint8_t gg, uint8_t bb, uint8_t aa = 255)
        : r(rr), g(gg), b(bb), a(aa) { }

    uint8_t r;
    uint8_t g;
    uint8_t b;
    uint8_t a;

    rgba_t operator+(const rgba_t &o) const {
        return rgba_t(
            clamp(std::lround(r + o.r), 0l, 255l),
            clamp(std::lround(g + o.g), 0l, 255l),
            clamp(std::lround(b + o.b), 0l, 255l),
            a);
    }

    rgba_t operator*(float mul) const {
        return rgba_t(
            clamp(std::lround(r * mul), 0l, 255l),
            clamp(std::lround(g * mul), 0l, 255l),
            clamp(std::lround(b * mul), 0l, 255l),
            a);
    }
};

struct lbgr_t {
    lbgr_t() : l(0), b(0), g(0), r(0) { }
    lbgr_t(uint8_t ll, uint8_t gg, uint8_t bb, uint8_t rr)
        : l(ll), b(bb), g(gg), r(rr) { }

    uint8_t l;
    uint8_t b;
    uint8_t g;
    uint8_t r;
};

