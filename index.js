'use strict';

const http = require('http');
const fs = require('fs');

const PREFECTURES = [
  { code: '1', name: '北海道' },
  { code: '2', name: '青森県' },
  { code: '3', name: '岩手県' },
  { code: '4', name: '宮城県' },
  { code: '5', name: '秋田県' },
  { code: '6', name: '山形県' },
  { code: '7', name: '福島県' },
  { code: '8', name: '茨城県' },
  { code: '9', name: '栃木県' },
  { code: '10', name: '群馬県' },
  { code: '11', name: '埼玉県' },
  { code: '12', name: '千葉県' },
  { code: '13', name: '東京都' },
  { code: '14', name: '神奈川県' },
  { code: '15', name: '新潟県' },
  { code: '16', name: '富山県' },
  { code: '17', name: '石川県' },
  { code: '18', name: '福井県' },
  { code: '19', name: '山梨県' },
  { code: '20', name: '長野県' },
  { code: '21', name: '岐阜県' },
  { code: '22', name: '静岡県' },
  { code: '23', name: '愛知県' },
  { code: '24', name: '三重県' },
  { code: '25', name: '滋賀県' },
  { code: '26', name: '京都府' },
  { code: '27', name: '大阪府' },
  { code: '28', name: '兵庫県' },
  { code: '29', name: '奈良県' },
  { code: '30', name: '和歌山県' },
  { code: '31', name: '鳥取県' },
  { code: '32', name: '島根県' },
  { code: '33', name: '岡山県' },
  { code: '34', name: '広島県' },
  { code: '35', name: '山口県' },
  { code: '36', name: '徳島県' },
  { code: '37', name: '香川県' },
  { code: '38', name: '愛媛県' },
  { code: '39', name: '高知県' },
  { code: '40', name: '福岡県' },
  { code: '41', name: '佐賀県' },
  { code: '42', name: '長崎県' },
  { code: '43', name: '熊本県' },
  { code: '44', name: '大分県' },
  { code: '45', name: '宮崎県' },
  { code: '46', name: '鹿児島県' },
  { code: '47', name: '沖縄県' },
];

var trimEkidataJson = (src) => {
  let res = src.replace(`if(typeof(xml)=='undefined') xml = {};`, '');
  res = res.replace(`xml.data = `, '');
  res = res.replace(`if(typeof(xml.onload)=='function') xml.onload(xml.data);`, '');
  return res.trim();
};

var getLines = () => {
  const promises = PREFECTURES.map(pref => {
    return new Promise((resolve, reject) => {
      const req = http.request(`http://www.ekidata.jp/api/p/${pref.code}.json`, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const lines = JSON.parse(trimEkidataJson(body));
            resolve(lines.line);
          } catch (e) {
            console.warn(`Failed to parse lines of ${pref.name}`);
            resolve([]);
          }
        });
      });

      req.on('error', (e) => {
        console.error(`Request failed! ${e.message}`);
        reject(e);
      });

      req.end();
    });
  });

  return Promise.all(promises);
};

var getStations = (lines) => {
  const promises = lines.map(line => {
    return new Promise((resolve, reject) => {
      const req = http.request(`http://www.ekidata.jp/api/l/${line.line_cd}.json`, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const stations = JSON.parse(trimEkidataJson(body));
            resolve(stations.station_l.map(s => {
              return {
                line: line.line_name,
                name: s.station_name,
                lon: parseFloat(s.lon),
                lat: parseFloat(s.lat)
              };
            }));
          } catch (e) {
            console.warn(`Failed to parse stations of ${line.line_name}`);
            resolve([]);
          }
        });
      });

      req.on('error', (e) => {
        console.error(`Request failed! ${e.message}`);
        reject(e);
      });

      req.end();
    });
  });

  return Promise.all(promises);
};

var saveStations = (stations) => {
  console.log('Sorting stations...');
  stations.sort((a, b) => {
    if (a.lon < b.lon) return -1;
    if (a.lon > b.lon) return 1;
    if (a.lat < b.lat) return -1;
    if (a.lat > b.lat) return 1;
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare != 0) return nameCompare;
    return a.line.localeCompare(b.line);
  });

  console.log('Filtering stations...');
  stations = stations.filter((s, index) => {
    const same = stations.findIndex(x => x.line === s.line && x.name === s.name);
    return index === same;
  });

  fs.writeFileSync('./stations.json', JSON.stringify(stations, undefined, 2));
  console.log(`${stations.length} stations saved.`);

  return Promise.resolve();
};

exports.handler = (event, context) => {
  console.log('---------- Start');
  let startTime = Date.now();

  Promise.resolve()
    .then(() => {
      console.log(`[ Getting lines ]`);
      return getLines();
    })
    .then(nestedLines => {
      const lines = Array.prototype.concat.apply([], nestedLines);
      console.log(`${lines.length} lines retrieved.`);
      console.log(`[ Getting stations ]`);
      return getStations(lines);
    })
    .then(nestedStations => {
      const stations = Array.prototype.concat.apply([], nestedStations);
      console.log(`${stations.length} stations retrieved.`);
      console.log(`[ Saving stations ]`);
      return saveStations(stations);
    })
    .then(() => {
      console.log(`Total time: ${Date.now() - startTime}ms`);
      context.succeed('---------- Finished');
    })
    .catch(err => {
      console.error('Error!', err.message);
      context.fail('---------- Failed!');
    });
};