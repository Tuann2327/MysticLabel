#!/usr/bin/env sh

# stop on error
set -e

# build
npm run build

# go into dist folder
cd dist

# if deploying to https://<USERNAME>.github.io/<REPO>
git init
git add -A
git commit -m "deploy"

git push -f https://github.com/tuann2327/MysticLabel.git main:gh-pages

cd -
