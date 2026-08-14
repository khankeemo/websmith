CC = gcc
CFLAGS = -Wall -Wextra -fPIC -std=c11
LDFLAGS = -lcurl -lcjson -lssl -lcrypto

all: libwebsmith_sdk.a

libwebsmith_sdk.a: client.o
	ar rcs $@ $^

client.o: client.h client.c
	$(CC) $(CFLAGS) -c client.c -o client.o

clean:
	rm -f *.o *.a

.PHONY: all clean
