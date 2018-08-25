const commander = require('commander');
const chalk = require('chalk');
const request = require('superagent');
const axios = require('axios');
const parser = require('xml2json');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://graduel-bfm.limoges.fr/ms/images';

// Get info
async function getInfo() {
  console.log('Getting information...');
  return new Promise((resolve, reject) => {
    request
      .get('http://graduel-bfm.limoges.fr/ms/images/B870856101_MS002_001R/ImageProperties.xml')
      .buffer()
      .type('xml')
      .end((err, res) => {
        // Reject promise if error
        if (err) {
          return reject(new Error(err));
        }

        // Output info
        try {
          const infoRaw = JSON.parse(parser.toJson(res.text));
          const pageInfo = {
            width: infoRaw.IMAGE_PROPERTIES.WIDTH,
            height: infoRaw.IMAGE_PROPERTIES.HEIGHT,
            tiles: infoRaw.IMAGE_PROPERTIES.NUMTILES,
            tileSize: infoRaw.IMAGE_PROPERTIES.TILESIZE,
          };
          resolve(pageInfo);
        } catch(e) {
          reject(new Error('Unable to parse info data'));
        }
      });
    });
}

// Get tiles
async function getTiles() {
  request
    .get('http://graduel-bfm.limoges.fr/ms/images/B870856101_MS002_001R/TileGroup0')
    .buffer()
    .end((err, res) => {
      // Reject promise if error
      if (err) {
        console.error('Get Info Error', err);
      }

      console.log('TileGroup0 information:', res);
    });
}

// Get matrix based on page info
function getMatrix(pageInfo) {
  const tilesPerRow = pageInfo.width / pageInfo.tileSize;
  const tilesPerColumn = pageInfo.height / pageInfo.tileSize;
  // console.log(tilesPerRow, tilesPerColumn);
  let matrix = [];
  for (let i = 0; i < tilesPerColumn; i++) {
    let matrixRow = [];
    const y = i * pageInfo.tileSize;
    for (let n = 0; n < tilesPerRow; n++) {
      const x = n * pageInfo.tileSize;
      matrixRow.push({ x, y, tileCode: `${n}-${i}` })
    }
    matrix.push(matrixRow);
  }
  return matrix;
}

// Download tiles of a row
async function downloadRow(tilesPerRow) {
  for (let i = 0; i < tilesPerRow; i++) {

  }
}

async function downloadTile(tileCode) {
  try {
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}/B870856101_MS002_001R/TileGroup0/5-${tileCode}.jpg`,
      responseType: 'stream'
    });
    return response.data;
  } catch (error) {
    if (error.response.status !== 404)
      return new Error('Unknown error', error.response.status);

    try {
      const response = await axios({
        method: 'GET',
        url: `${BASE_URL}/B870856101_MS002_001R/TileGroup1/5-${tileCode}.jpg`,
        responseType: 'stream'
      });
      return response.data;
    } catch (error) {
      if (error.response.status !== 404)
        return new Error('Unknown error', error.response.status);

      try {
        const response = await axios({
          method: 'GET',
          url: `${BASE_URL}/B870856101_MS002_001R/TileGroup2/5-${tileCode}.jpg`,
          responseType: 'stream'
        });
        return response.data;
      } catch (error) {
        return new Error('Unknown error', error.response.status);
      }
    }
  }
}

async function exportTiles(img, imgName) {
  console.log(`Exporting tile: ${imgName}.jpg ...`);
  try {
    const imgPath = path.resolve(__dirname, 'images', imgName + '.jpg');
    await img.pipe(fs.createWriteStream(imgPath));
    console.log('File saved!');
  } catch (error) {
    console.log('Error', error);
    throw new Error('Error while saving');
  }
}

async function combineTiles(pageNumber, map, originalWidth, originalHeight) {
  try {
      process.stdout.write(` Creating canvas...                            \r`);
      // Load blank canvas
      const canvas = await images('./blank/blank.jpg');

      // Resize canvas to match original size
      await canvas.size(originalWidth, originalHeight);

      // Put all tiles onto canvas
      for (let i = 0; i < map.length; i++) {
          const currentRow = map[i];
          for (let k = 0; k < currentRow.length; k++) {
              const percentage =
                  ((((k + 1) / currentRow.length) + i) / map.length) * 100;
              process.stdout.write(` Combining tiles... ${percentage.toFixed(1)}%                        \r`);
              // Set current tile path
              const tilePath = `./tiles/tile_${('0000' + i).substr(-4)}_${('0000' + k).substr(-4)}.jpg`;
              // Put current tile onto canvas
              await canvas.draw(images(tilePath), currentRow[k][0], currentRow[k][1]);
          }
      }

      // Output result
      process.stdout.write(` Exporting result...                      \r`);
      await canvas.save(`./pages/page_${('0000' + pageNumber).substr(-4)}.jpg`, {
          quality: 100
      });

      // Clean up tiles folder
      process.stdout.write(` Cleaning up tiles...                     \r`);
      await rimraf('tiles/*.*', () => { });
  } catch (error) {
      console.log('\nERROR COMBINING IMAGES', error);
  }
}

// Main function
async function main() {
  const pageInfo = await getInfo();
  const matrix = getMatrix(pageInfo);
  console.log('Matrix', matrix);
  // const tile = await downloadTile('0-23');
  // await exportImage(tile, '0-23');
}

// Execute main program
main();
