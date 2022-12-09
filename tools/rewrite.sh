#!/bin/bash

usage() {
    cat <<EOF

Copies the source LMDB database in order to free disc space.

Example usage:

./$1 --input ./cache --output ./cache-copy

Mandatory args:
  -i,--input      input database path
  -o,--output     output database path

Optional args:
  -h,--help       print this help
EOF
    return 0
}

defaults() {
    NUM_CHUNKS_IN_BATCH=1
}

parseOptions() {
    options=$(getopt -o h,i:,o: -l help,input:,output: -- "$@")
    if [ $? -ne 0 ]; then
        usage $(basename $0)
        exit 1
    fi
    eval set -- "$options"

    while true; do
        case "$1" in
        -h | --help) usage $(basename $0) && exit 0 ;;
        -i | --input)
            INPUT=$(readlink -f $2)
            shift 2
            ;;
        -o | --output)
            OUTPUT=$(readlink -f $2)
            shift 2
            ;;
        --)
            shift 1
            break
            ;;
        *) break ;;
        esac
    done

    # Verify arguments
    if [ ! -d $INPUT ]; then
        echo "Specify input path (-i,--input): $INPUT"
        exit 1
    fi

    if [ -z $OUTPUT ]; then
        echo "Specify output path (-o,--output)"
        exit 1
    fi
}

run() {
    export NODE_OPTIONS="-r ts-node/register --no-warnings --max-old-space-size=4000"
    for i in $(seq 0 $NUM_CHUNKS_IN_BATCH 100); do
        node ./rewrite.ts -i $INPUT -o $OUTPUT -s $i -c $NUM_CHUNKS_IN_BATCH
        result=$?
        if [ $result = 12 ]; then
            # There's still data
            continue
        fi
        if [ $result != 0 ]; then
            echo
            echo Failed rewrite, rerun with: 
            echo "NODE_OPTIONS=\"-r ts-node/register --no-warnings --max-old-space-size=4000\" ts-node ./rewrite.ts -i $INPUT -o $OUTPUT -s $i -c $NUM_CHUNKS_IN_BATCH"
            echo 
            continue
        fi

        #  No more data
        exit 0
    done
}

defaults
parseOptions "$@"
command pushd "$(dirname "$0")" >/dev/null
run
command popd >/dev/null
echo
