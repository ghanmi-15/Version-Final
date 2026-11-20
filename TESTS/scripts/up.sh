#!/bin/bash
# usage: up.sh  -> démarre MySQL (si besoin)
if ! mysqladmin -uroot -h127.0.0.1 ping --silent 2>/dev/null; then
  rm -f /var/run/mysqld/mysqld.sock* /var/run/mysqld/mysqlx.sock*
  setsid nohup mysqld --user=mysql --bind-address=127.0.0.1 --port=3306 > /tmp/mysqld.log 2>&1 < /dev/null &
  for i in $(seq 1 40); do mysqladmin -uroot -h127.0.0.1 ping --silent 2>/dev/null && break; sleep 1; done
fi
mysqladmin -uroot -h127.0.0.1 ping 2>&1 | head -1
