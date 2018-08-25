const commander = require('commander');
const chalk = require('chalk');
const request = require('superagent');
const axios = require('axios');
const parser = require('xml2json');
const images = require('images');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://graduel-bfm.limoges.fr/ms/images';

// Get info
async function getFolioInfo(folioNumber, isV) {
  console.log(`Getting information for ${folioNumber}${isV ? 'V' : 'R'}...`);
  const PAGE_URL = `${BASE_URL}/B870856101_MS002_${('00' + folioNumber).substr(-4)}${isV ? 'V' : 'R'}`;

  return new Promise((resolve, reject) => {
    request
      .get(`${PAGE_URL}/ImageProperties.xml`)
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
            pageURL: PAGE_URL,
          };
          resolve(pageInfo);
        } catch(e) {
          reject(new Error('Unable to parse info data'));
        }
      });
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

async function downloadTile(pageURL, tileCode) {
  try {
    const response = await axios({
      method: 'GET',
      url: `${pageURL}/TileGroup0/5-${tileCode}.jpg`,
      responseType: 'stream'
    });
    return response.data;
  } catch (error) {
    if (error.response.status !== 404)
      return new Error('Unknown error', error.response.status);

    try {
      const response = await axios({
        method: 'GET',
        url: `${pageURL}/TileGroup1/5-${tileCode}.jpg`,
        responseType: 'stream'
      });
      return response.data;
    } catch (error) {
      if (error.response.status !== 404)
        return new Error('Unknown error', error.response.status);

      try {
        const response = await axios({
          method: 'GET',
          url: `${pageURL}/TileGroup2/5-${tileCode}.jpg`,
          responseType: 'stream'
        });
        return response.data;
      } catch (error) {
        return new Error('Unknown error', error.response.status);
      }
    }
  }
}

async function getTiles(pageURL, map) {
  try {
      for (let i = 0; i < map.length; i++) {
        const currentRow = map[i];
        for (let k = 0; k < currentRow.length; k++) {
            const percentage =
                ((((k + 1) / currentRow.length) + i) / map.length) * 100;
            process.stdout.write(` Downloading tiles... ${percentage.toFixed(1)}%                       \r`);
              // Set up path for image
            const tilePath = path.resolve(__dirname, 'tiles', `${currentRow[k].tileCode}.jpg`);
            // Request
            const tile = await downloadTile(pageURL, currentRow[k].tileCode);
            // Pipe the result stream into a file on disc
            await tile.pipe(fs.createWriteStream(tilePath));
        }
      }
  } catch (error) {
      console.log('\nERROR GETTING TILES', error);
  }
}

async function combineTiles(folioNumber, isV, map, originalWidth, originalHeight) {
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
              const tilePath = `./tiles/${currentRow[k].tileCode}.jpg`;
              // Put current tile onto canvas
              await canvas.draw(images(tilePath), currentRow[k].x  , currentRow[k].y);
          }
      }

      // Output result
      process.stdout.write(` Exporting result...                      \r`);
      await canvas.save(`./folios/folio_${('00' + folioNumber).substr(-4)}.jpg`, {
          quality: 100
      });

      // Clean up tiles folder
      // process.stdout.write(` Cleaning up tiles...                     \r`);
      // await rimraf('tiles/*.*', () => { });
  } catch (error) {
      console.log('\nERROR COMBINING IMAGES', error);
  }
}

// Main function
async function main() {
  // const info = await getFolioInfo(1);
  // const map = getMatrix(info);
  // await getTiles(info.pageURL, map);
  await combineTiles(1, false, map, info.width, info.height);
}

// Execute main program
main();
