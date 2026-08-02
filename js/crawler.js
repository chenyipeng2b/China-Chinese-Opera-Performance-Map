/**
 * 戏曲演出数据爬虫脚本
 * 多源数据采集：美团/猫眼、摩天轮票务、大麦网、永乐票务、
 * 秀动/票牛、搜狗微信、戏曲文化网站等平台
 * 由 GitHub Actions 定时执行
 *
 * 运行: node js/crawler.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ==================== 城市坐标映射 ====================
const CITY_COORDS = {
  '北京': { lng: 116.3838, lat: 39.9131 },
  '上海': { lng: 121.4737, lat: 31.2304 },
  '广州': { lng: 113.3245, lat: 23.1291 },
  '深圳': { lng: 114.0579, lat: 22.5431 },
  '杭州': { lng: 120.2103, lat: 30.2474 },
  '成都': { lng: 104.0657, lat: 30.6595 },
  '重庆': { lng: 106.5516, lat: 29.5630 },
  '武汉': { lng: 114.3054, lat: 30.5931 },
  '南京': { lng: 118.7969, lat: 32.0603 },
  '西安': { lng: 108.9402, lat: 34.2608 },
  '郑州': { lng: 113.7532, lat: 34.7681 },
  '天津': { lng: 117.1902, lat: 39.1252 },
  '苏州': { lng: 120.5853, lat: 31.2989 },
  '长沙': { lng: 112.9388, lat: 28.2278 },
  '合肥': { lng: 117.2714, lat: 31.8586 },
  '济南': { lng: 117.0009, lat: 36.6758 },
  '福州': { lng: 119.2965, lat: 26.0745 },
  '昆明': { lng: 102.8329, lat: 24.8801 },
  '沈阳': { lng: 123.4315, lat: 41.8057 },
  '哈尔滨': { lng: 126.6424, lat: 45.7567 },
  '长春': { lng: 125.3235, lat: 43.8171 },
  '石家庄': { lng: 114.5149, lat: 38.0428 },
  '太原': { lng: 112.5492, lat: 37.8570 },
  '呼和浩特': { lng: 111.7490, lat: 40.8424 },
  '南宁': { lng: 108.3661, lat: 22.8170 },
  '贵阳': { lng: 106.6302, lat: 26.6470 },
  '兰州': { lng: 103.8343, lat: 36.0611 },
  '西宁': { lng: 101.7782, lat: 36.6171 },
  '银川': { lng: 106.2309, lat: 38.4872 },
  '乌鲁木齐': { lng: 87.6168, lat: 43.8256 },
  '拉萨': { lng: 91.1172, lat: 29.6500 },
  '海口': { lng: 110.1999, lat: 20.0440 },
  '南昌': { lng: 115.8582, lat: 28.6829 }
};

const CITY_PROVINCE = {
  '北京': '北京市', '上海': '上海市', '天津': '天津市', '重庆': '重庆市',
  '广州': '广东省', '深圳': '广东省', '东莞': '广东省', '佛山': '广东省',
  '杭州': '浙江省', '宁波': '浙江省', '温州': '浙江省', '绍兴': '浙江省',
  '成都': '四川省', '绵阳': '四川省',
  '武汉': '湖北省', '宜昌': '湖北省',
  '南京': '江苏省', '苏州': '江苏省', '无锡': '江苏省', '常州': '江苏省',
  '西安': '陕西省', '咸阳': '陕西省',
  '郑州': '河南省', '洛阳': '河南省', '开封': '河南省',
  '长沙': '湖南省',
  '合肥': '安徽省',
  '济南': '山东省', '青岛': '山东省',
  '福州': '福建省', '厦门': '福建省',
  '昆明': '云南省',
  '沈阳': '辽宁省', '大连': '辽宁省',
  '哈尔滨': '黑龙江省',
  '长春': '吉林省',
  '石家庄': '河北省', '保定': '河北省',
  '太原': '山西省',
  '呼和浩特': '内蒙古自治区',
  '南宁': '广西壮族自治区', '桂林': '广西壮族自治区',
  '贵阳': '贵州省',
  '兰州': '甘肃省',
  '西宁': '青海省',
  '银川': '宁夏回族自治区',
  '乌鲁木齐': '新疆维吾尔自治区',
  '拉萨': '西藏自治区',
  '海口': '海南省', '三亚': '海南省',
  '南昌': '江西省'
};

const GENRE_KEYWORDS = ['京剧', '越剧', '豫剧', '川剧', '昆曲', '粤剧', '秦腔', '黄梅戏', '评剧', '沪剧', '晋剧', '河北梆子', '花鼓戏', '婺剧', '潮剧'];

// ==================== HTTP 工具 ====================
function httpGet(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      ...opts.headers
    };
    const req = client.get(url, { headers, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        httpGet(redirectUrl, opts).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ==================== 工具函数 ====================
function getCoords(city) {
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (city.includes(key)) return coords;
  }
  return { lng: 116.3838, lat: 39.9131 };
}

function getProvince(city) {
  for (const [key, province] of Object.entries(CITY_PROVINCE)) {
    if (city.includes(key)) return province;
  }
  return '北京市';
}

function extractCity(text) {
  const cityNames = Object.keys(CITY_COORDS);
  for (const city of cityNames) {
    if (text.includes(city)) return city;
  }
  return '北京';
}

function extractGenre(text) {
  for (const genre of GENRE_KEYWORDS) {
    if (text.includes(genre)) return genre;
  }
  return '戏曲';
}

function extractDate(text) {
  const patterns = [
    /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/g,
    /(\d{1,2})月(\d{1,2})[日号]/g
  ];
  const now = new Date();
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    for (const m of matches) {
      try {
        if (m.length === 4) {
          return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
        } else if (m.length === 3) {
          const year = now.getFullYear();
          const month = parseInt(m[1]);
          const day = parseInt(m[2]);
          const targetYear = (month < now.getMonth() + 1) ? year + 1 : year;
          return targetYear + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        }
      } catch (e) { /* skip */ }
    }
  }
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function decodeHtml(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<em>/g, '')
    .replace(/<\/em>/g, '')
    .replace(/<[^>]*>/g, '');
}

function cleanText(text) {
  return decodeHtml(text)
    .replace(/\s+/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

// ==================== 1. 美团/猫眼演出 ====================
async function crawlMeituanMaoyan() {
  console.log('[美团/猫眼] 搜索戏曲演出...');
  const results = [];
  const keywords = ['戏曲', '京剧', '越剧', '昆曲'];

  for (const keyword of keywords) {
    try {
      const url = 'https://show.maoyan.com/queryshows?keyword=' + encodeURIComponent(keyword);
      const html = await httpGet(url, {
        headers: {
          'Referer': 'https://show.maoyan.com/',
          'Accept': 'application/json, text/plain, */*'
        }
      });

      if (html.trim().startsWith('{')) {
        try {
          const json = JSON.parse(html);
          const shows = json.data?.shows || json.data?.list || [];
          for (const show of shows) {
            const name = show.name || show.showName || show.title || '';
            if (!name || name.length < 2) continue;
            if (!GENRE_KEYWORDS.some(g => name.includes(g)) && !/戏曲|折子戏/.test(name)) continue;

            const city = extractCity(show.city || show.cityName || '');
            const venue = show.venue || show.venueName || show.address || (city + '剧院');
            const date = show.showTime || show.startTime || extractDate(JSON.stringify(show));
            const coords = getCoords(city);

            results.push({
              id: 'my_' + Date.now() + '_' + results.length,
              name: name.substring(0, 50),
              genre: extractGenre(name + ' ' + keyword),
              province: getProvince(city),
              city: city,
              address: venue,
              startDate: typeof date === 'string' ? date.substring(0, 10) : extractDate(name + keyword),
              endDate: typeof date === 'string' ? date.substring(0, 10) : extractDate(name + keyword),
              troupe: show.troupe || '待确认',
              description: show.desc || show.description || '来自猫眼演出搜索',
              lng: coords.lng,
              lat: coords.lat,
              source: 'crawled',
              sourcePlatform: '猫眼演出'
            });
          }
          continue;
        } catch (jsonErr) { /* fallback */ }
      }

      const itemRegex = /<a[^>]*href="\/show\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
      const items = html.match(itemRegex) || [];

      for (const item of items) {
        const text = cleanText(item);
        const isOpera = GENRE_KEYWORDS.some(g => text.includes(g)) || /戏曲|折子戏/.test(text);
        if (!isOpera || text.length < 3) continue;

        const city = extractCity(text);
        const coords = getCoords(city);
        const date = extractDate(text);

        results.push({
          id: 'my_' + Date.now() + '_' + results.length,
          name: text.substring(0, 50),
          genre: extractGenre(text),
          province: getProvince(city),
          city: city,
          address: city + '剧院',
          startDate: date,
          endDate: date,
          troupe: '待确认',
          description: '来自猫眼演出搜索',
          lng: coords.lng,
          lat: coords.lat,
          source: 'crawled',
          sourcePlatform: '猫眼演出'
        });
      }

      console.log('[美团/猫眼] "' + keyword + '" 解析出 ' + results.length + ' 条');
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error('[美团/猫眼] "' + keyword + '" 失败:', error.message);
    }
  }

  return results;
}

// ==================== 2. 摩天轮票务 ====================
async function crawlMoretickets() {
  console.log('[摩天轮票务] 搜索戏曲演出...');
  const results = [];

  try {
    const url = 'https://www.moretickets.com/search?keyword=' + encodeURIComponent('戏曲');
    const html = await httpGet(url, {
      headers: {
        'Referer': 'https://www.moretickets.com/',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });

    if (!html || html.length < 500) return results;

    const cardRegex = /<div[^>]*class="[^"]*show-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/gi;
    const cards = html.match(cardRegex) || [];

    if (cards.length === 0) {
      const altRegex = /<a[^>]*href="\/show\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
      const altCards = html.match(altRegex) || [];
      for (const card of altCards) {
        const text = cleanText(card);
        if (!/戏曲|京剧|越剧|昆曲|豫剧|粤剧|川剧/.test(text)) continue;
        if (text.length < 3) continue;

        const city = extractCity(text);
        const coords = getCoords(city);
        const date = extractDate(text);

        results.push({
          id: 'mt_' + Date.now() + '_' + results.length,
          name: text.substring(0, 50),
          genre: extractGenre(text),
          province: getProvince(city),
          city: city,
          address: city + '剧院',
          startDate: date,
          endDate: date,
          troupe: '待确认',
          description: '来自摩天轮票务搜索',
          lng: coords.lng,
          lat: coords.lat,
          source: 'crawled',
          sourcePlatform: '摩天轮票务'
        });
      }
      console.log('[摩天轮票务] 备选模式解析 ' + results.length + ' 条');
      return results;
    }

    for (const card of cards) {
      try {
        const nameMatch = card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) ||
                          card.match(/<span[^>]*class="[^"]*name[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
                          card.match(/<a[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
        if (!nameMatch) continue;
        const name = cleanText(nameMatch[1]);

        const isOpera = GENRE_KEYWORDS.some(g => name.includes(g)) || /戏曲|折子戏/.test(name);
        if (!isOpera) continue;

        const cityMatch = card.match(/<span[^>]*class="[^"]*city[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
                          card.match(/<span[^>]*class="[^"]*venue[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        const city = cityMatch ? extractCity(cleanText(cityMatch[1])) : extractCity(card);

        const venueMatch = card.match(/<span[^>]*class="[^"]*venue[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        const venue = venueMatch ? cleanText(venueMatch[1]) : (city + '剧院');

        const date = extractDate(card);
        const coords = getCoords(city);

        results.push({
          id: 'mt_' + Date.now() + '_' + results.length,
          name: name.substring(0, 50),
          genre: extractGenre(name),
          province: getProvince(city),
          city: city,
          address: venue,
          startDate: date,
          endDate: date,
          troupe: '待确认',
          description: '来自摩天轮票务搜索',
          lng: coords.lng,
          lat: coords.lat,
          source: 'crawled',
          sourcePlatform: '摩天轮票务'
        });
      } catch (e) { /* skip */ }
    }

    console.log('[摩天轮票务] 解析出 ' + results.length + ' 条');
  } catch (error) {
    console.error('[摩天轮票务] 爬取失败:', error.message);
  }

  return results;
}

// ==================== 3. 搜狗微信搜索 ====================
async function crawlSogouWeixin(keyword) {
  console.log('[搜狗微信] 搜索: "' + keyword + '"');
  const results = [];

  try {
    const encodedKeyword = encodeURIComponent(keyword);
    const url = 'https://weixin.sogou.com/weixin?type=2&query=' + encodedKeyword + '&ie=utf8';
    const html = await httpGet(url);

    if (!html || html.length < 500) {
      console.log('[搜狗微信] 返回内容过短，可能被反爬');
      return results;
    }

    const itemRegex = /<li[^>]*class="[^"]*news-list2[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    const items = html.match(itemRegex) || [];

    for (const item of items) {
      try {
        const titleMatch = item.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        if (!titleMatch) continue;
        const title = cleanText(titleMatch[2]);
        const link = titleMatch[1].replace(/&amp;/g, '&');

        const summaryMatch = item.match(/<p[^>]*class="[^"]*txt-info[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
        const summary = summaryMatch ? cleanText(summaryMatch[1]) : '';

        const sourceMatch = item.match(/<span[^>]*class="[^"]*s2[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        const source = sourceMatch ? cleanText(sourceMatch[1]) : '';

        const fullText = title + ' ' + summary + ' ' + source;

        const isOperaRelated = GENRE_KEYWORDS.some(g => fullText.includes(g)) ||
          /戏曲|演出|舞台|剧场|剧院|巡演|开票|上演/.test(fullText);
        if (!isOperaRelated) continue;

        const city = extractCity(fullText);
        const genre = extractGenre(fullText);
        const date = extractDate(fullText);
        const coords = getCoords(city);

        results.push({
          id: 'wx_' + Date.now() + '_' + results.length,
          name: title.substring(0, 50),
          genre: genre,
          province: getProvince(city),
          city: city,
          address: city + '剧院',
          startDate: date,
          endDate: date,
          troupe: source || '待确认',
          description: summary.substring(0, 100) || '来自微信公众号信息',
          lng: coords.lng,
          lat: coords.lat,
          source: 'crawled',
          sourcePlatform: '微信公众号',
          sourceLink: link
        });
      } catch (e) { /* skip */ }
    }

    console.log('[搜狗微信] 解析出 ' + results.length + ' 条');
  } catch (error) {
    console.error('[搜狗微信] 爬取失败:', error.message);
  }

  return results;
}

// ==================== 4. 大麦网搜索 ====================
async function crawlDamai() {
  console.log('[大麦网] 搜索戏曲演出...');
  const results = [];
  const keywords = ['戏曲', '京剧', '越剧', '昆曲', '豫剧'];

  for (const keyword of keywords) {
    try {
      const url = 'https://search.damai.cn/search.htm?keyword=' + encodeURIComponent(keyword);
      const html = await httpGet(url, {
        headers: { 'Referer': 'https://www.damai.cn/' }
      });

      const cardRegex = /<div[^>]*class="[^"]*items[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
      const cards = html.match(cardRegex) || [];

      for (const card of cards) {
        const nameMatch = card.match(/<a[^>]*class="[^"]*name[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
                          card.match(/<span[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        if (!nameMatch) continue;
        const name = cleanText(nameMatch[1]);

        const isOpera = GENRE_KEYWORDS.some(g => name.includes(g)) || /戏曲|折子戏/.test(name);
        if (!isOpera) continue;

        const cityMatch = card.match(/<span[^>]*class="[^"]*city[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
                          card.match(/<span[^>]*class="[^"]*venue[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        const city = cityMatch ? extractCity(cleanText(cityMatch[1])) : '北京';

        const dateMatch = card.match(/<span[^>]*class="[^"]*time[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
                          card.match(/<span[^>]*class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        const dateText = dateMatch ? cleanText(dateMatch[1]) : '';
        const date = dateText ? extractDate(dateText) : extractDate(card);

        const venueMatch = card.match(/<span[^>]*class="[^"]*venue[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
        const venue = venueMatch ? cleanText(venueMatch[1]) : (city + '剧院');

        const coords = getCoords(city);
        const genre = extractGenre(name + ' ' + keyword);

        results.push({
          id: 'dm_' + Date.now() + '_' + results.length,
          name: name.substring(0, 50),
          genre: genre,
          province: getProvince(city),
          city: city,
          address: venue,
          startDate: date,
          endDate: date,
          troupe: '待确认',
          description: '来自大麦网搜索"' + keyword + '"',
          lng: coords.lng,
          lat: coords.lat,
          source: 'crawled',
          sourcePlatform: '大麦网'
        });
      }

      console.log('[大麦网] "' + keyword + '" 解析出 ' + results.length + ' 条');
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error('[大麦网] "' + keyword + '" 失败:', error.message);
    }
  }

  return results;
}

// ==================== 5. 永乐票务 ====================
async function crawlYongle() {
  console.log('[永乐票务] 搜索戏曲演出...');
  const results = [];

  try {
    const url = 'https://www.228.com.cn/search/?keyword=' + encodeURIComponent('戏曲');
    const html = await httpGet(url);

    const itemRegex = /<li[^>]*class="[^"]*item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
    const items = html.match(itemRegex) || [];

    for (const item of items) {
      const nameMatch = item.match(/<a[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
                        item.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      if (!nameMatch) continue;
      const name = cleanText(nameMatch[1]);

      const isOpera = GENRE_KEYWORDS.some(g => name.includes(g)) || /戏曲/.test(name);
      if (!isOpera) continue;

      const city = extractCity(item);
      const coords = getCoords(city);
      const genre = extractGenre(name);
      const date = extractDate(item);

      results.push({
        id: 'yl_' + Date.now() + '_' + results.length,
        name: name.substring(0, 50),
        genre: genre,
        province: getProvince(city),
        city: city,
        address: city + '剧院',
        startDate: date,
        endDate: date,
        troupe: '待确认',
        description: '来自永乐票务搜索结果',
        lng: coords.lng,
        lat: coords.lat,
        source: 'crawled',
        sourcePlatform: '永乐票务'
      });
    }

    console.log('[永乐票务] 解析出 ' + results.length + ' 条');
  } catch (error) {
    console.error('[永乐票务] 爬取失败:', error.message);
  }

  return results;
}

// ==================== 6. 聚合平台 ====================
async function crawlAggregators() {
  console.log('[聚合平台] 搜索戏曲演出...');
  const results = [];
  const platforms = [
    { url: 'https://www.showstart.com/search?keyword=', name: '秀动', kw: '戏曲' },
    { url: 'https://www.piaoniu.com/search?keyword=', name: '票牛', kw: '戏曲' }
  ];

  for (const pf of platforms) {
    try {
      const url = pf.url + encodeURIComponent(pf.kw);
      const html = await httpGet(url, {
        headers: { 'Accept': 'text/html,application/xhtml+xml' }
      });

      if (!html || html.length < 300) continue;

      const itemRegex = /<a[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
      const items = html.match(itemRegex) || [];

      let count = 0;
      for (const item of items) {
        if (count >= 5) break;
        const text = cleanText(item);
        const isOpera = GENRE_KEYWORDS.some(g => text.includes(g)) || /戏曲/.test(text);
        if (!isOpera || text.length < 3) continue;

        const city = extractCity(text);
        const coords = getCoords(city);
        const date = extractDate(text);

        results.push({
          id: 'ag_' + Date.now() + '_' + results.length,
          name: text.substring(0, 50),
          genre: extractGenre(text),
          province: getProvince(city),
          city: city,
          address: city + '剧院',
          startDate: date,
          endDate: date,
          troupe: '待确认',
          description: '来自' + pf.name + '搜索',
          lng: coords.lng,
          lat: coords.lat,
          source: 'crawled',
          sourcePlatform: pf.name
        });
        count++;
      }

      console.log('[聚合平台] ' + pf.name + ' 解析出 ' + count + ' 条');
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error('[聚合平台] ' + pf.name + ' 失败:', error.message);
    }
  }

  return results;
}

// ==================== 7. 戏曲文化网站 ====================
async function crawlOperaSites() {
  console.log('[戏曲网站] 搜索演出资讯...');
  const results = [];
  const urls = [
    { url: 'https://www.xi-qu.com/', name: '戏曲网' },
    { url: 'https://www.chinaopera.net/', name: '中国戏曲网' },
    { url: 'https://www.xiju.net/', name: '戏剧网' }
  ];

  for (const site of urls) {
    try {
      const html = await httpGet(site.url);
      if (!html || html.length < 500) {
        console.log('[戏曲网站] ' + site.name + ' 返回内容不足');
        continue;
      }

      const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const links = html.match(linkRegex) || [];

      let count = 0;
      for (const linkStr of links) {
        if (count >= 5) break;
        const m = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(linkStr);
        if (!m) continue;
        const text = cleanText(m[2]);

        const isOpera = GENRE_KEYWORDS.some(g => text.includes(g)) ||
          /演出|戏曲|剧场|上演|开票|巡演|折子戏/.test(text);
        if (!isOpera || text.length < 4) continue;

        const city = extractCity(text);
        const coords = getCoords(city);
        const genre = extractGenre(text);
        const date = extractDate(text);

        results.push({
          id: 'op_' + Date.now() + '_' + results.length,
          name: text.substring(0, 50),
          genre: genre,
          province: getProvince(city),
          city: city,
          address: city + '剧院',
          startDate: date,
          endDate: date,
          troupe: '待确认',
          description: '来自' + site.name + '资讯',
          lng: coords.lng,
          lat: coords.lat,
          source: 'crawled',
          sourcePlatform: site.name
        });
        count++;
      }

      console.log('[戏曲网站] ' + site.name + ' 解析出 ' + count + ' 条');
      await new Promise(r => setTimeout(r, 1500));
    } catch (error) {
      console.error('[戏曲网站] ' + site.name + ' 失败:', error.message);
    }
  }

  return results;
}

// ==================== 主流程 ====================
async function crawlAll() {
  console.log('='.repeat(60));
  console.log('[爬虫] 多源爬取戏曲演出数据');
  console.log('[爬虫] 时间:', new Date().toISOString());
  console.log('='.repeat(60));

  const allResults = [];

  console.log('\n--- 第1站：美团/猫眼 ---');
  const meituanResults = await crawlMeituanMaoyan();
  allResults.push(...meituanResults);

  console.log('\n--- 第2站：摩天轮票务 ---');
  const moreticketsResults = await crawlMoretickets();
  allResults.push(...moreticketsResults);

  console.log('\n--- 第3站：大麦网 ---');
  const damaiResults = await crawlDamai();
  allResults.push(...damaiResults);

  console.log('\n--- 第4站：永乐票务 ---');
  const yongleResults = await crawlYongle();
  allResults.push(...yongleResults);

  console.log('\n--- 第5站：聚合票务平台 ---');
  const aggregatorResults = await crawlAggregators();
  allResults.push(...aggregatorResults);

  console.log('\n--- 第6站：微信公众号 ---');
  const weixinKeywords = ['戏曲演出', '京剧演出', '越剧演出', '昆曲演出', '戏曲开票', '剧场戏曲'];
  for (const kw of weixinKeywords) {
    const wxResults = await crawlSogouWeixin(kw);
    allResults.push(...wxResults);
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n--- 第7站：戏曲文化网站 ---');
  const operaSiteResults = await crawlOperaSites();
  allResults.push(...operaSiteResults);

  console.log('\n[爬虫] 总计爬取 ' + allResults.length + ' 条');

  if (allResults.length === 0) {
    console.log('[爬虫] 未爬取到数据，生成示例数据');
    return generateSampleData();
  }

  return allResults;
}

// ==================== 示例数据 ====================
function generateSampleData() {
  const genres = ['京剧', '越剧', '豫剧', '川剧', '昆曲', '粤剧', '秦腔', '黄梅戏', '评剧', '沪剧'];
  const cities = ['北京', '上海', '广州', '杭州', '成都', '武汉', '南京', '西安', '郑州', '苏州', '天津', '重庆'];
  const troupes = [
    '国家京剧院', '上海京剧院', '北京京剧院', '天津京剧院',
    '浙江小百花越剧团', '江苏省昆剧院', '河南省豫剧院',
    '成都市川剧院', '广州粤剧院', '西安秦腔剧院',
    '安徽省黄梅戏剧院', '上海沪剧院'
  ];
  const venues = {
    '北京': ['国家大剧院', '梅兰芳大剧院', '长安大戏院'],
    '上海': ['上海大剧院', '天蟾逸夫舞台', '东方艺术中心'],
    '广州': ['广州大剧院', '友谊剧院'],
    '杭州': ['杭州大剧院', '浙江胜利剧院'],
    '成都': ['锦江剧场', '成都城市音乐厅'],
    '武汉': ['武汉琴台大剧院', '湖北剧院'],
    '南京': ['江苏大剧院', '南京保利大剧院'],
    '西安': ['陕西大剧院', '易俗大剧院'],
    '郑州': ['河南艺术中心', '郑州大剧院'],
    '苏州': ['苏州文化艺术中心', '苏州昆剧院'],
    '天津': ['天津大剧院', '天津滨湖剧院'],
    '重庆': ['重庆大剧院', '重庆国泰艺术中心']
  };
  const playNames = [
    '《贵妃醉酒》', '《霸王别姬》', '《锁麟囊》', '《四郎探母》',
    '《梁山伯与祝英台》', '《红楼梦》', '《西厢记》',
    '《花木兰》', '《穆桂英挂帅》',
    '《白蛇传》', '《变脸》',
    '《牡丹亭》', '《长生殿》', '《桃花扇》',
    '《帝女花》',
    '《三滴血》', '《火焰驹》',
    '《天仙配》', '《女驸马》'
  ];

  const results = [];
  const now = new Date();

  for (let i = 0; i < 10; i++) {
    const city = cities[i % cities.length];
    const genre = genres[i % genres.length];
    const play = playNames[Math.floor(Math.random() * playNames.length)];
    const coords = getCoords(city);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 45) - 5);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 4) + 2);
    const cityVenues = venues[city] || [city + '大剧院'];

    results.push({
      id: 'sample_' + Date.now() + '_' + i,
      name: genre + play,
      genre: genre,
      province: getProvince(city),
      city: city,
      address: cityVenues[Math.floor(Math.random() * cityVenues.length)],
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      troupe: troupes[i % troupes.length],
      description: '经典' + genre + '剧目，传承中华优秀传统文化',
      lng: coords.lng,
      lat: coords.lat,
      source: 'crawled',
      sourcePlatform: '示例数据'
    });
  }

  return results;
}

// ==================== 数据合并与保存 ====================
function normalizeData(item) {
  return {
    id: item.id || ('cr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
    name: (item.name || '').replace(/[「」『』《》]/g, '').substring(0, 80).trim(),
    genre: item.genre || extractGenre(item.name || ''),
    province: item.province || getProvince(item.city || ''),
    city: item.city || '北京',
    address: item.address || (item.city || '北京') + '剧院',
    startDate: item.startDate || extractDate(item.name || ''),
    endDate: item.endDate || item.startDate || extractDate(item.name || ''),
    troupe: item.troupe || '待确认',
    description: (item.description || '').substring(0, 200).trim(),
    lng: item.lng || getCoords(item.city || '').lng,
    lat: item.lat || getCoords(item.city || '').lat,
    source: item.source || 'crawled',
    sourcePlatform: item.sourcePlatform || '未知来源'
  };
}

function isValidPerformance(item) {
  const name = item.name || '';
  if (name.length < 2) return false;
  if (name.length > 100) return false;
  const noisePatterns = /^\d+$|^[a-zA-Z\s]+$|广告|推广|招聘|出售|转让|优惠|折扣|活动|课程|培训|讲座|展览|电影|综艺|相声|脱口秀|话剧|音乐剧|舞蹈|芭蕾|交响|合唱/;
  if (noisePatterns.test(name)) return false;
  const operaKeywords = [...GENRE_KEYWORDS, '戏曲', '折子戏', '折子', '戏班', '梨园', '曲艺', '昆腔', '高腔', '梆子'];
  const isOpera = operaKeywords.some(k => name.includes(k));
  if (!isOpera) return false;
  return true;
}

function deduplicatePerformances(performances) {
  const map = new Map();
  for (const p of performances) {
    const key = (p.name + '_' + p.city + '_' + p.startDate).replace(/\s/g, '');
    const existing = map.get(key);
    if (!existing || (p.description || '').length > (existing.description || '').length) {
      map.set(key, p);
    }
  }
  return Array.from(map.values());
}

async function main() {
  try {
    const crawledData = await crawlAll();
    const dataPath = path.join(__dirname, '..', 'data', 'performances.json');
    let existingData = [];
    try {
      existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (e) {
      console.log('[爬虫] 未找到现有数据文件，创建新文件');
    }

    const manualData = existingData.filter(p => p.source === 'manual');
    const normalized = crawledData.map(normalizeData).filter(isValidPerformance);
    const deduped = deduplicatePerformances(normalized);

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const cutoff = new Date(now.getTime() - 3 * 86400000);
    const recentCrawled = deduped.filter(p => {
      const endDate = new Date(p.endDate + 'T23:59:59');
      return endDate >= cutoff;
    });

    const merged = [...manualData, ...recentCrawled];
    merged.sort((a, b) => a.startDate.localeCompare(b.startDate));

    fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2), 'utf8');

    console.log('\n' + '='.repeat(60));
    console.log('[爬虫] 完成！');
    console.log('  总计: ' + merged.length + ' 条');
    console.log('  手动: ' + manualData.length + ' 条');
    console.log('  爬取: ' + recentCrawled.length + ' 条');
    console.log('  过滤: ' + (crawledData.length - recentCrawled.length) + ' 条（去重/过期/无效）');
    console.log('  来源分布:');
    const sourceStats = {};
    recentCrawled.forEach(p => {
      const sp = p.sourcePlatform || '未知';
      sourceStats[sp] = (sourceStats[sp] || 0) + 1;
    });
    Object.entries(sourceStats).forEach(([k, v]) => console.log('    - ' + k + ': ' + v + ' 条'));
    recentCrawled.forEach(p => {
      console.log('    [' + p.sourcePlatform + '] ' + p.name + ' (' + p.city + ', ' + p.startDate + ')');
    });
    console.log('='.repeat(60));
  } catch (error) {
    console.error('[爬虫] 执行失败:', error);
    process.exit(1);
  }
}

main();
