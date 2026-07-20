cmake_minimum_required(VERSION 3.14)
project(wsd_sdk VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

find_package(OpenSSL REQUIRED)
find_package(CURL REQUIRED)

file(GLOB SDK_SOURCES
    "${CMAKE_CURRENT_SOURCE_DIR}/*.cpp"
)

add_library(wsd_sdk STATIC ${SDK_SOURCES})

target_include_directories(wsd_sdk PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(wsd_sdk PUBLIC OpenSSL::SSL OpenSSL::Crypto CURL::libcurl)

if(WIN32)
    target_link_libraries(wsd_sdk PUBLIC iphlpapi wbemuuid)
endif()

if(APPLE)
    target_link_libraries(wsd_sdk PUBLIC "-framework IOKit" "-framework CoreFoundation")
endif()

# Example executable
add_executable(wsd_example main.cpp)
target_link_libraries(wsd_example PRIVATE wsd_sdk)
target_include_directories(wsd_example PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})

# Install
install(TARGETS wsd_sdk wsd_example
    RUNTIME DESTINATION bin
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
)
install(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    DESTINATION include
    FILES_MATCHING PATTERN "*.h"
)
install(FILES config/api-config.json DESTINATION config)
install(FILES manifest.json README.md DESTINATION .)
