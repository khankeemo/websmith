CC = gcc
CFLAGS = -std=c11 -Wall -Wextra -pedantic -O2 -g
LDFLAGS = -lssl -lcrypto -lcurl
AR = ar

SRCS = crypto.c hardware.c cache.c client.c license_engine.c activation.c \
       device_replace.c renewal.c welcome.c widgets.c
OBJS = $(SRCS:.c=.o)
HEADERS = crypto.h hardware.h cache.h client.h license_engine.h \
          activation.h device_replace.h renewal.h welcome.h widgets.h

LIB = libwsd_sdk.a
EXAMPLE = wsd_example

.PHONY: all clean install

all: $(LIB) $(EXAMPLE)

$(LIB): $(OBJS)
	$(AR) rcs $@ $^

$(EXAMPLE): main.o $(LIB)
	$(CC) $(CFLAGS) -o $@ main.o -L. -lwsd_sdk $(LDFLAGS)

%.o: %.c $(HEADERS)
	$(CC) $(CFLAGS) -c $< -o $@

main.o: main.c
	$(CC) $(CFLAGS) -c main.c -o main.o

clean:
	rm -f *.o $(LIB) $(EXAMPLE)

install: $(LIB)
	mkdir -p $(DESTDIR)/usr/local/lib
	mkdir -p $(DESTDIR)/usr/local/include/wsd_sdk
	cp $(LIB) $(DESTDIR)/usr/local/lib/
	cp $(HEADERS) $(DESTDIR)/usr/local/include/wsd_sdk/
	cp config/api-config.json $(DESTDIR)/usr/local/etc/wsd_sdk/
