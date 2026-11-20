#!/bin/bash
# usage: startbe.sh <orig|new> <port> <db> <logfile> [extra classpath dir override]
MODE=$1; PORT=$2; DB=$3; LOG=$4; NEWCLASSES=${5:-/tmp/be/new/classes}
J17=/usr/lib/jvm/java-17-openjdk-amd64/bin/java
LIB="/tmp/be/orig/BOOT-INF/lib/*"
if [ "$MODE" = "orig" ]; then CP="/tmp/be/orig/BOOT-INF/classes:$LIB"; else CP="$NEWCLASSES:$LIB"; fi
URL="jdbc:mysql://localhost:3306/${DB}?createDatabaseIfNotExist=true&useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true"
setsid nohup $J17 -cp "$CP" com.ecommerce.EcommerceApplication --server.port=$PORT "--spring.datasource.url=$URL" --spring.jpa.show-sql=false > $LOG 2>&1 < /dev/null &
for i in $(seq 1 60); do grep -qE "Started EcommerceApplication|APPLICATION FAILED|Application run failed" $LOG 2>/dev/null && break; sleep 1; done
grep -E "Started EcommerceApplication|APPLICATION FAILED|Application run failed" $LOG | cut -c1-160 | head -2
