#!/bin/bash

root="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
source "$LSN_COMMON/functions"
cd $root

proc=$(ps -fC lsn-jsc)
if [ "$?" == "0" ]; then
  echo $proc
  if (! ask_yn 'Run anyway?'); then
    exit 0;
  fi
fi

build_files=(
  specs/ecma.hf
  specs/livesite.hf
  specs/hub.hf
  specs/app.hf
  specs/lsn-adaptors.hf
  src/share/web/res/tabset/js/build.hf
  src/share/web/res/html/photo/build.hf
)

lsn-jsc ${build_files[@]} $@

#
# For debugging, this prompts (pauses) before building each file
#
# for file in ${build_files[@]}; do
#   if (ask_yn "Build $file?"); then
#     $root/src/bin/lsn-jsc $file $@
#   fi
# done
#
