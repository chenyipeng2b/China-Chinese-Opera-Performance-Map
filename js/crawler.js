/**
 * 戏曲演出数据爬虫脚本
 * 多源数据采集：搜狗微信搜索、大麦网、永乐票务等平台
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

// ==================== 1. 搜狗微信搜索 ====================
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

    console.log('[搜狗微信] 找到 ' + items.length + ' 个搜索结果');

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

// ==================== 2. 大麦网搜索 ====================
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

// ==================== 3. 永乐票务 ====================
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

// ==================== 4. 戏曲资讯站 ====================
async function crawlOperaSites() {
  console.log('[戏曲网站] 搜索演出资讯...');
  const results = [];
  const urls = [
    { url: 'https://www.xi-qu.com/', name: '戏曲网' }
  ];

  for (const site of urls) {
    try {
      const html = await httpGet(site.url);
      if (!html || html.length < 500) continue;

      const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const links = html.match(linkRegex) || [];

      let count = 0;
      for (const linkStr of links) {
        if (count >= 5) break;
        const m = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(linkStr);
        if (!m) continue;
        const text = cleanText(m[2]);

        const isOpera = GENRE_KEYWORDS.some(g => text.includes(g)) ||
          /演出|戏曲|剧场|上演|开票|巡演/.test(text);

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

  // 1. 搜狗微信搜索
  const weixinKeywords = ['戏曲演出', '京剧演出', '越剧演出', '昆曲演出', '戏曲开票', '剧场戏曲'];
  for (const kw of weixinKeywords) {
    const wxResults = await crawlSogouWeixin(kw);
    allResults.push(...wxResults);
    await new Promise(r => setTimeout(r, 3000));
  }

  // 2. 大麦网
  const damaiResults = await crawlDamai();
  allResults.push(...damaiResults);

  // 3. 永乐票务
  const yongleResults = await crawlYongle();
  allResults.push(...yongleResults);

  // 4. 戏曲资讯站
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

    const seen = new Set();
    const uniqueCrawled = crawledData.filter(p => {
      const key = p.name + '_' + p.startDate + '_' + p.city;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const merged = [...manualData, ...uniqueCrawled];
    merged.sort((a, b) => a.startDate.localeCompare(b.startDate));

    fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2), 'utf8');

    console.log('\n' + '='.repeat(60));
    console.log('[爬虫] 完成！');
    console.log('  总计: ' + merged.length + ' 条');
    console.log('  手动: ' + manualData.length + ' 条');
    console.log('  爬取: ' + uniqueCrawled.length + ' 条');
    uniqueCrawled.forEach(p => {
      console.log('    - [' + p.sourcePlatform + '] ' + p.name + ' (' + p.city + ', ' + p.startDate + ')');
    });
    console.log('='.repeat(60));
  } catch (error) {
    console.error('[爬虫] 执行失败:', error);
    process.exit(1);
  }
}

main();
