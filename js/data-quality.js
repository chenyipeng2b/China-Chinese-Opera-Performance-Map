/**
 * 中国戏曲演出地图 - 数据质量管理模块
 * 功能：智能去重、数据校验清洗、自动状态更新、数据源标注
 */
(function() {
    'use strict';

    window.DataQuality = {
        // ========== 配置 ==========
        config: {
            // 相似度阈值（0-1），超过此值视为重复
            dedupThreshold: 0.75,
            // 过期数据清理天数（结束后超过此天数自动标记）
            expiredDays: 90,
            // 是否启用自动状态刷新
            autoRefresh: true,
            // 自动刷新间隔（毫秒）
            refreshInterval: 3600000 // 1小时
        },

        // ========== 数据校验规则 ==========
        rules: {
            required: ['name', 'genre', 'city', 'startDate'],
            dateFormat: /^\d{4}-\d{2}-\d{2}$/,
            coordRange: { lng: [-180, 180], lat: [-90, 90] },
            nameMinLength: 2,
            nameMaxLength: 200
        },

        /**
         * 校验单条演出数据
         * @param {Object} perf - 演出对象
         * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
         */
        validate: function(perf) {
            var errors = [];
            var warnings = [];
            var rules = this.rules;

            // 必填字段检查
            rules.required.forEach(function(field) {
                if (!perf[field] || (typeof perf[field] === 'string' && !perf[field].trim())) {
                    errors.push('缺少必填字段: ' + field);
                }
            });

            // 日期格式检查
            if (perf.startDate && !rules.dateFormat.test(perf.startDate)) {
                errors.push('开始日期格式错误: ' + perf.startDate);
            }
            if (perf.endDate && !rules.dateFormat.test(perf.endDate)) {
                errors.push('结束日期格式错误: ' + perf.endDate);
            }

            // 日期逻辑检查
            if (perf.startDate && perf.endDate && rules.dateFormat.test(perf.startDate) && rules.dateFormat.test(perf.endDate)) {
                if (perf.startDate > perf.endDate) {
                    errors.push('开始日期晚于结束日期: ' + perf.startDate + ' > ' + perf.endDate);
                }
            }

            // 坐标范围检查
            if (perf.lng !== undefined && (perf.lng < rules.coordRange.lng[0] || perf.lng > rules.coordRange.lng[1])) {
                errors.push('经度超出范围: ' + perf.lng);
            }
            if (perf.lat !== undefined && (perf.lat < rules.coordRange.lat[0] || perf.lat > rules.coordRange.lat[1])) {
                errors.push('纬度超出范围: ' + perf.lat);
            }

            // 名称长度检查
            if (perf.name && perf.name.length < rules.nameMinLength) {
                errors.push('演出名称过短: "' + perf.name + '"');
            }
            if (perf.name && perf.name.length > rules.nameMaxLength) {
                warnings.push('演出名称过长: ' + perf.name.length + '字符');
            }

            // 乱码检测（包含不可打印字符）
            if (perf.name && /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(perf.name)) {
                errors.push('演出名称包含乱码字符');
            }
            if (perf.actors && /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(perf.actors)) {
                warnings.push('演员信息可能包含乱码');
            }

            // 空值/占位符检测
            var placeholderPatterns = ['暂无', '未知', '待定', 'N/A', 'null', 'undefined', 'TBD', 'TBA'];
            placeholderPatterns.forEach(function(ph) {
                if (perf.actors && perf.actors.toLowerCase().indexOf(ph.toLowerCase()) !== -1) {
                    warnings.push('演员信息包含占位符: "' + ph + '"');
                }
                if (perf.troupe && perf.troupe.toLowerCase().indexOf(ph.toLowerCase()) !== -1) {
                    warnings.push('剧团信息包含占位符: "' + ph + '"');
                }
            });

            // 城市-省份一致性检查
            var cityProvinceMap = {
                '北京': '北京市', '上海': '上海市', '天津': '天津市', '重庆': '重庆市',
                '广州': '广东省', '深圳': '广东省', '杭州': '浙江省', '南京': '江苏省',
                '苏州': '江苏省', '成都': '四川省', '武汉': '湖北省', '西安': '陕西省',
                '郑州': '河南省', '长沙': '湖南省', '合肥': '安徽省', '福州': '福建省',
                '南昌': '江西省', '济南': '山东省', '太原': '山西省', '石家庄': '河北省',
                '沈阳': '辽宁省', '长春': '吉林省', '哈尔滨': '黑龙江省',
                '昆明': '云南省', '贵阳': '贵州省', '南宁': '广西壮族自治区',
                '兰州': '甘肃省', '西宁': '青海省', '银川': '宁夏回族自治区',
                '呼和浩特': '内蒙古自治区', '乌鲁木齐': '新疆维吾尔自治区',
                '拉萨': '西藏自治区', '海口': '海南省'
            };
            if (perf.city && perf.province && cityProvinceMap[perf.city]) {
                var expectedProvince = cityProvinceMap[perf.city];
                if (perf.province !== expectedProvince && !perf.province.includes(expectedProvince.replace('省','').replace('自治区','').replace('市',''))) {
                    warnings.push('城市"' + perf.city + '"与省份"' + perf.province + '"可能不匹配，期望: ' + expectedProvince);
                }
            }

            return {
                valid: errors.length === 0,
                errors: errors,
                warnings: warnings,
                score: errors.length === 0 ? (warnings.length === 0 ? 100 : 80) : Math.max(0, 60 - errors.length * 20)
            };
        },

        /**
         * 计算两条演出数据的相似度（0-1）
         */
        similarity: function(a, b) {
            var score = 0;
            var total = 0;

            // 名称相似度（权重最高）
            if (a.name && b.name) {
                total += 4;
                score += this._strSimilarity(a.name, b.name) * 4;
            }

            // 场馆相似度
            var venueA = a.address || a.venue || '';
            var venueB = b.address || b.venue || '';
            if (venueA && venueB) {
                total += 3;
                score += this._strSimilarity(venueA, venueB) * 3;
            }

            // 日期重叠度
            if (a.startDate && b.startDate && a.endDate && b.endDate) {
                total += 2;
                var overlap = this._dateOverlap(a.startDate, a.endDate, b.startDate, b.endDate);
                score += overlap * 2;
            }

            // 城市相同
            if (a.city && b.city) {
                total += 1;
                score += (a.city === b.city ? 1 : 0);
            }

            return total > 0 ? score / total : 0;
        },

        /**
         * 字符串相似度（Jaccard + 编辑距离混合）
         */
        _strSimilarity: function(s1, s2) {
            s1 = (s1 || '').toLowerCase().replace(/[《》「」『』\s]/g, '');
            s2 = (s2 || '').toLowerCase().replace(/[《》「」『』\s]/g, '');
            if (s1 === s2) return 1;
            if (!s1 || !s2) return 0;

            // 包含关系
            if (s1.indexOf(s2) !== -1 || s2.indexOf(s1) !== -1) return 0.9;

            // Jaccard 相似度（基于2-gram字符对）
            var grams1 = {}, grams2 = {}, intersection = 0, union = 0;
            for (var i = 0; i < s1.length - 1; i++) {
                var g = s1.substring(i, i + 2);
                grams1[g] = (grams1[g] || 0) + 1;
            }
            for (var j = 0; j < s2.length - 1; j++) {
                var g2 = s2.substring(j, j + 2);
                grams2[g2] = (grams2[g2] || 0) + 1;
            }
            var allGrams = {};
            Object.keys(grams1).forEach(function(k) { allGrams[k] = true; });
            Object.keys(grams2).forEach(function(k) { allGrams[k] = true; });
            Object.keys(allGrams).forEach(function(k) {
                var c1 = grams1[k] || 0;
                var c2 = grams2[k] || 0;
                intersection += Math.min(c1, c2);
                union += Math.max(c1, c2);
            });
            return union > 0 ? intersection / union : 0;
        },

        /**
         * 计算日期重叠比例
         */
        _dateOverlap: function(start1, end1, start2, end2) {
            var s1 = new Date(start1 + 'T00:00:00').getTime();
            var e1 = new Date(end1 + 'T23:59:59').getTime();
            var s2 = new Date(start2 + 'T00:00:00').getTime();
            var e2 = new Date(end2 + 'T23:59:59').getTime();

            var overlapStart = Math.max(s1, s2);
            var overlapEnd = Math.min(e1, e2);
            if (overlapStart > overlapEnd) return 0;

            var overlap = overlapEnd - overlapStart;
            var range1 = e1 - s1;
            var range2 = e2 - s2;
            var totalRange = Math.max(e1, e2) - Math.min(s1, s2);
            if (totalRange <= 0) return 0;
            return overlap / Math.max(range1, range2);
        },

        /**
         * 智能去重：找出重复的演出数据
         * @param {Array} perfs - 演出数据数组
         * @returns {{ unique: Array, duplicates: Array, report: Object }}
         */
        deduplicate: function(perfs) {
            var threshold = this.config.dedupThreshold;
            var duplicates = [];
            var duplicateIds = {};
            var report = { total: perfs.length, duplicateCount: 0, groups: [] };

            for (var i = 0; i < perfs.length; i++) {
                if (duplicateIds[perfs[i].id || i]) continue;
                for (var j = i + 1; j < perfs.length; j++) {
                    if (duplicateIds[perfs[j].id || j]) continue;
                    var sim = this.similarity(perfs[i], perfs[j]);
                    if (sim >= threshold) {
                        duplicateIds[perfs[i].id || i] = true;
                        duplicateIds[perfs[j].id || j] = true;
                        duplicates.push(perfs[j]);
                        report.groups.push({
                            original: perfs[i],
                            duplicate: perfs[j],
                            similarity: Math.round(sim * 100) / 100
                        });
                    }
                }
            }

            report.duplicateCount = Object.keys(duplicateIds).length;
            var unique = perfs.filter(function(p) { return !duplicateIds[p.id]; });

            return { unique: unique, duplicates: duplicates, report: report };
        },

        /**
         * 批量校验所有数据
         * @returns {{ valid: number, invalid: number, warnings: number, details: Array, summary: Object }}
         */
        validateAll: function(perfs) {
            var results = {
                valid: 0, invalid: 0, warningCount: 0,
                details: [],
                summary: { total: perfs.length, errors: {}, warnings: {} }
            };

            perfs.forEach(function(p, i) {
                var result = this.validate(p);
                result._index = i;
                result._id = p.id || ('idx_' + i);
                result._name = p.name || '未命名';
                results.details.push(result);

                if (result.valid) {
                    results.valid++;
                } else {
                    results.invalid++;
                }

                if (result.warnings.length > 0) {
                    results.warningCount++;
                }

                // 统计错误类型
                result.errors.forEach(function(e) {
                    var type = e.split(':')[0];
                    results.summary.errors[type] = (results.summary.errors[type] || 0) + 1;
                });
                result.warnings.forEach(function(w) {
                    var type = w.split(':')[0];
                    results.summary.warnings[type] = (results.summary.warnings[type] || 0) + 1;
                });
            }, this);

            return results;
        },

        /**
         * 自动刷新演出状态
         * 将已过期的演出标记出来，供用户确认清理
         */
        refreshStatus: function(perfs) {
            var now = new Date();
            var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            var expiredThreshold = new Date(today.getTime() - this.config.expiredDays * 86400000);

            var statusChanges = [];
            var expiredItems = [];

            perfs.forEach(function(p) {
                var endDate = new Date(p.endDate + 'T23:59:59');
                if (endDate < expiredThreshold) {
                    expiredItems.push({
                        id: p.id,
                        name: p.name,
                        endDate: p.endDate,
                        daysSinceEnd: Math.floor((today - endDate) / 86400000)
                    });
                }

                // 检查即将演出 -> 演出中的状态变更
                var startDate = new Date(p.startDate + 'T00:00:00');
                if (startDate <= today && today <= endDate && p._status !== 'live') {
                    statusChanges.push({ id: p.id, name: p.name, from: p._status, to: 'live' });
                }
                // 检查演出中 -> 已结束
                if (today > endDate && p._status === 'live') {
                    statusChanges.push({ id: p.id, name: p.name, from: 'live', to: 'ended' });
                }
            });

            return {
                statusChanges: statusChanges,
                expiredItems: expiredItems,
                expiredCount: expiredItems.length,
                changedCount: statusChanges.length
            };
        },

        /**
         * 数据源标注
         * 为每条数据标注来源类型和可信度
         */
        annotateSource: function(perfs) {
            var sourceStats = { manual: 0, crawled: 0, other: 0, total: perfs.length };
            var platformStats = {};

            perfs.forEach(function(p) {
                if (p.source === 'manual') {
                    sourceStats.manual++;
                    p._trustLevel = 'high';
                } else if (p.source === 'crawled') {
                    sourceStats.crawled++;
                    p._trustLevel = 'medium';
                    var platform = p.sourcePlatform || '未知来源';
                    platformStats[platform] = (platformStats[platform] || 0) + 1;
                } else {
                    sourceStats.other++;
                    p._trustLevel = 'low';
                }

                // 有完整信息的爬取数据提升可信度
                if (p._trustLevel === 'medium' && p.actors && p.troupe && p.description) {
                    p._trustLevel = 'medium-high';
                }
                // 缺少关键信息的降低可信度
                if (!p.actors && !p.troupe && p.source === 'crawled') {
                    p._trustLevel = 'low-medium';
                }
            });

            return {
                sourceStats: sourceStats,
                platformStats: platformStats,
                annotated: perfs
            };
        },

        /**
         * 生成数据质量报告
         */
        generateReport: function(perfs) {
            var dedupResult = this.deduplicate(perfs);
            var validationResult = this.validateAll(perfs);
            var refreshResult = this.refreshStatus(perfs);
            var sourceResult = this.annotateSource(perfs);

            // 数据完整性统计
            var completeness = {
                withActors: perfs.filter(function(p) { return p.actors && p.actors.trim(); }).length,
                withTroupe: perfs.filter(function(p) { return p.troupe && p.troupe.trim(); }).length,
                withDescription: perfs.filter(function(p) { return p.description && p.description.trim(); }).length,
                withPrice: perfs.filter(function(p) { return p.price && p.price.trim(); }).length,
                withTransport: perfs.filter(function(p) { return p.transport && p.transport.trim(); }).length,
                total: perfs.length
            };

            // 时间分布
            var timeDistribution = { past7: 0, past30: 0, future7: 0, future30: 0, future90: 0, later: 0 };
            var now = new Date();
            var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            perfs.forEach(function(p) {
                var start = new Date(p.startDate + 'T00:00:00');
                var end = new Date(p.endDate + 'T23:59:59');
                var daysToStart = Math.ceil((start - today) / 86400000);
                var daysSinceEnd = Math.ceil((today - end) / 86400000);

                if (daysSinceEnd > 0 && daysSinceEnd <= 7) timeDistribution.past7++;
                else if (daysSinceEnd > 0 && daysSinceEnd <= 30) timeDistribution.past30++;
                else if (daysToStart >= 0 && daysToStart <= 7) timeDistribution.future7++;
                else if (daysToStart > 7 && daysToStart <= 30) timeDistribution.future30++;
                else if (daysToStart > 30 && daysToStart <= 90) timeDistribution.future90++;
                else if (daysToStart > 90) timeDistribution.later++;
            });

            return {
                timestamp: new Date().toISOString(),
                totalRecords: perfs.length,
                dedup: dedupResult.report,
                validation: {
                    valid: validationResult.valid,
                    invalid: validationResult.invalid,
                    warnings: validationResult.warningCount,
                    summary: validationResult.summary
                },
                refresh: refreshResult,
                source: sourceResult.sourceStats,
                platforms: sourceResult.platformStats,
                completeness: completeness,
                timeDistribution: timeDistribution,
                qualityScore: Math.round(
                    (validationResult.valid / Math.max(1, perfs.length)) * 40 +
                    (1 - dedupResult.report.duplicateCount / Math.max(1, perfs.length)) * 30 +
                    (completeness.withActors / Math.max(1, perfs.length)) * 15 +
                    (completeness.withDescription / Math.max(1, perfs.length)) * 15
                )
            };
        },

        /**
         * 启动自动状态刷新定时器
         */
        startAutoRefresh: function(getDataFn, onRefreshFn) {
            if (!this.config.autoRefresh) return;
            var self = this;
            setInterval(function() {
                var perfs = getDataFn();
                if (perfs && perfs.length > 0) {
                    var result = self.refreshStatus(perfs);
                    if (result.changedCount > 0 && onRefreshFn) {
                        onRefreshFn(result);
                    }
                }
            }, this.config.refreshInterval);
        }
    };

    console.log('[数据质量] 模块初始化完成');
})();
