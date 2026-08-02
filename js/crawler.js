/**
 * 戏曲演出数据爬虫脚本
 * 从大麦网、猫眼等平台爬取戏曲类演出信息
 * 由 GitHub Actions 定时执行
 * 
 * 运行: node js/crawler.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 中国主要城市坐标映射
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

// 城市到省份映射
const CITY_PROVINCE = {
  '北京': '北京市', '上海': '上海市', '天津': '天津市', '重庆': '重庆市',
  '广州': '广东省', '深圳': '广东省',
  '杭州': '浙江省', '成都': '四川省', '武汉': '湖北省', '南京': '江苏省',
  '西安': '陕西省', '郑州': '河南省', '苏州': '江苏省', '长沙': '湖南省',
  '合肥': '安徽省', '济南': '山东省', '福州': '福建省', '昆明': '云南省',
  '沈阳': '辽宁省', '哈尔滨': '黑龙江省', '长春': '吉林省', '石家庄': '河北省',
  '太原': '山西省', '呼和浩特': '内蒙古自治区', '南宁': '广西壮族自治区',
  '贵阳': '贵州省', '兰州': '甘肃省', '西宁': '青海省', '银川': '宁夏回族自治区',
  '乌鲁木齐': '新疆维吾尔自治区', '拉萨': '西藏自治区', '海口': '海南省',
  '南昌': '江西省'
};

/**
 * HTTP GET 请求
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * 从搜索结果中提取演出信息
 * 目前作为框架，实际爬取逻辑需要根据目标网站结构调整
 */
function extractPerformances(html) {
  const results = [];
  
  // TODO: 根据实际目标网站结构编写解析逻辑
  // 示例：大麦网搜索"戏曲"结果的解析
  // 可以使用正则或 Cheerio 库进行 DOM 解析
  
  console.log('[爬虫] HTML 长度:', html.length);
  console.log('[爬虫] 需要根据目标网站实现具体解析逻辑');
  
  return results;
}

/**
 * 根据城市名获取坐标
 */
function getCoords(city) {
  for (const [key, coords] of Object.entries(CITY_COORDS)) {
    if (city.includes(key)) return coords;
  }
  return { lng: 116.3838, lat: 39.9131 }; // 默认北京
}

/**
 * 获取省份
 */
function getProvince(city) {
  for (const [key, province] of Object.entries(CITY_PROVINCE)) {
    if (city.includes(key)) return province;
  }
  return '北京市';
}

/**
 * 爬取数据并生成示例
 * 实际使用时替换为真实爬取逻辑
 */
async function crawl() {
  console.log('[爬虫] 开始爬取戏曲演出数据...');
  console.log('[爬虫] 时间:', new Date().toISOString());

  // 目标 URL（示例，需根据实际目标修改）
  const searchUrls = [
    // 'https://search.damai.cn/search.htm?keyword=戏曲',
    // 'https://search.damai.cn/search.htm?keyword=京剧',
    // 更多搜索 URL...
  ];

  const allResults = [];

  // 遍历搜索 URL
  for (const url of searchUrls) {
    try {
      console.log(`[爬虫] 爬取: ${url}`);
      const html = await httpGet(url);
      const results = extractPerformances(html);
      allResults.push(...results);
      console.log(`[爬虫] 从 ${url} 获取 ${results.length} 条结果`);
      
      // 避免请求过快
      await new Promise(r => setTimeout(r, 2000));
    } catch (error) {
      console.error(`[爬虫] 爬取失败 ${url}:`, error.message);
    }
  }

  // 如果没有爬取到数据，生成示例数据
  if (allResults.length === 0) {
    console.log('[爬虫] 未爬取到数据，生成示例数据');
    return generateSampleData();
  }

  return allResults;
}

/**
 * 生成示例数据（爬虫不可用时）
 */
function generateSampleData() {
  const genres = ['京剧', '越剧', '豫剧', '川剧', '昆曲', '粤剧', '秦腔', '黄梅戏'];
  const cities = ['北京', '上海', '广州', '杭州', '成都', '武汉', '南京', '西安', '郑州', '苏州'];
  const troupes = ['国家京剧院', '上海京剧院', '北京京剧院', '天津京剧院', '浙江小百花越剧团', '江苏省昆剧院', '河南省豫剧院', '成都市川剧院'];
  
  const results = [];
  const now = new Date();
  
  for (let i = 0; i < 8; i++) {
    const city = cities[i % cities.length];
    const coords = getCoords(city);
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30) - 5);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 2);
    
    results.push({
      id: 'crawled_' + Date.now() + '_' + i,
      name: genres[i % genres.length] + '《经典折子戏专场》',
      genre: genres[i % genres.length],
      province: getProvince(city),
      city: city,
      address: city + '大剧院',
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      troupe: troupes[i % troupes.length],
      description: '精彩戏曲演出，传承经典文化',
      lng: coords.lng,
      lat: coords.lat,
      source: 'crawled'
    });
  }
  
  return results;
}

/**
 * 合并数据并保存
 */
async function main() {
  try {
    const crawledData = await crawl();
    
    // 读取现有数据
    const dataPath = path.join(__dirname, '..', 'data', 'performances.json');
    let existingData = [];
    try {
      existingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (e) {
      console.log('[爬虫] 未找到现有数据文件，创建新文件');
    }

    // 合并数据：保留手动录入的数据，更新爬取数据
    const manualData = existingData.filter(p => p.source === 'manual');
    
    // 去重：根据名称和日期去重
    const allCrawled = [...crawledData];
    const seen = new Set();
    const uniqueCrawled = allCrawled.filter(p => {
      const key = `${p.name}_${p.startDate}_${p.city}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 合并
    const merged = [...manualData, ...uniqueCrawled];
    
    // 保存
    fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2), 'utf8');
    console.log(`[爬虫] 完成！总计 ${merged.length} 条数据（手动: ${manualData.length}, 爬取: ${uniqueCrawled.length}）`);
    
  } catch (error) {
    console.error('[爬虫] 执行失败:', error);
    process.exit(1);
  }
}

main();
