cmake_minimum_required(VERSION 3.6)

add_compile_options(-Wall)
add_compile_options(--std=c++14)
add_compile_options(-g)

add_executable(playback
  engine.cpp
  leds.cpp
  playback.cpp
  visuals.cpp
  lws.cpp
)
target_link_libraries(playback
  ev websockets pthread
)

add_executable(listener
  listener.cpp
  lws.cpp
  timecode.cpp
)
target_link_libraries(listener
  ev websockets jack
)
