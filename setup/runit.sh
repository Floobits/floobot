#!/bin/bash

cp -r runit /etc/sv/floobot

if [ ! -e /etc/service/floobot ]
then
    echo "/etc/service/floobot doesn't exist. Creating it..."
    ln -s /etc/sv/floobot /etc/service/
fi

if [ ! -e /service ]
then
    echo "/service doesn't exist. Creating it..."
    ln -s /etc/service /service
fi
