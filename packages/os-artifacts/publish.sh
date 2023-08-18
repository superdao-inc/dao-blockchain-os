#!/bin/sh

# Globals:
# - PACKAGE_VERSION
# - NPM_PUBLISH_TOKEN

if [ "$PACKAGE_VERSION" = "" ]; then
  echo "Please provide 'PACKAGE_VERSION'"
  exit 0
fi

if [ "$NPM_PUBLISH_TOKEN" = "" ]; then
  echo "Please provide 'NPM_PUBLISH_TOKEN'"
  exit 0
fi

rm -fr ./dist
mkdir ./dist

echo "copy typechain-types from root..."
cp -r ../../typechain-types ./dist/typechain-types

echo "copy artifacts from root..."
cp -r ../../artifacts/contracts/ ./dist/contracts
find ./dist/contracts -name "*.dbg.json" -type f -delete

echo "link npm to version ${PACKAGE_VERSION}..."
npm version --no-git-tag-version ${PACKAGE_VERSION}

echo "put token into npmrc..."
echo //registry.npmjs.org/:_authToken=${NPM_PUBLISH_TOKEN} >> .npmrc

echo "publish package..."
npm publish --access public
