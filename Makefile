### include mk/gnu.bsdvars.mk
# Some BSD compatibility declarations

.ALLSRC = $^
.ARCHIVE = $!
.IMPSRC = $<
.MEMBER = $%
.OODATE = $?
.PREFIX = $*
.TARGET = $@
.CURDIR = ${CURDIR}

### /include

YUICOMPRESSOR = yuicompressor

.SUFFIXES:
.SUFFIXES: js md html

TARGETS = runner.js
ALL_TARGETS = ${TARGETS} boot.min.js runner.min.js

LIBS = 

default: ${TARGETS}

all: ${ALL_TARGETS}

runner.js: src/stuff.js src/DOM.js src/interceptor.js src/processors.js 
	cat ${.ALLSRC} > ${.TARGET}

%.min.js: %.js
	${YUICOMPRESSOR} ${.IMPSRC} > ${.TARGET}

