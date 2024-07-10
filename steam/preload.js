const Registry = require('winreg'); // 导入winreg模块中的Registry构造函数
const fs = require('fs').promises;
const {exec} = require('child_process');

/**
 * steam方法
 */
class SteamService {

    /**
     * 获取注册表中值 | 固定注册表路径为steam
     * @param key steam下Key
     * @returns {Promise<string>} 注册表value
     */
    async getSteamValue(key) {
        try {
            const regKey = new Registry({
                hive: Registry.HKCU, // 使用Registry.HKCU常量
                key: '\\Software\\Valve\\Steam' // 注意路径字符串的书写
            });
            return await new Promise((resolve, reject) => {
                regKey.get(key, (error, result) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result.value);
                    }
                });
            });
        } catch (error) {
            console.log("寄" + error)
        }
    }

    /**
     * 设置注册表值 | 固定注册表路径为steam
     * @param name 注册表Key
     * @param value 写入值
     * @param valueType 写入类型
     * @returns {Promise<void>}
     */
    async setSteamValue(name, value, valueType) {
        try {
            const regKey = new Registry({
                hive: Registry.HKCU, // 使用Registry.HKCU常量
                key: '\\Software\\Valve\\Steam' // 注意路径字符串的书写
            });
            await new Promise((resolve, reject) => {
                regKey.set(name, valueType, value, (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            console.log("寄" + error)
        }
    }

    /**
     * 读取steam登录用户信息
     * @returns {Promise<*[]>} user列表
     */
    async readLoginUsersVdf() {
        const steamPath = await this.getSteamValue('SteamPath');
        const vdfPath = `${steamPath}\\config\\loginusers.vdf`;

        try {
            const data = await fs.readFile(vdfPath, 'utf8');
            // 正则表达式匹配用户数据块
            const userBlockRegex = /"(\d+)"\s*{\s*((?:"\w+"\s+"[^"]+",?\s*)*)\s*}/g;
            const users = [];

            let match;
            while ((match = userBlockRegex.exec(data)) !== null) {
                // 存储用户ID和字段字符串
                const userId = match[1];
                const fieldsString = match[2];

                // 正则表达式匹配字段名和值
                const fieldRegex = /"(\w+)"\s+"(\w+)"/g;
                let fieldMatch;
                const currentUser = {};

                while ((fieldMatch = fieldRegex.exec(fieldsString)) !== null) {
                    const key = fieldMatch[1];
                    const value = fieldMatch[2];
                    currentUser[key] = value;
                }

                // 过滤RememberPassword为0的用户
                if (currentUser.RememberPassword !== '0') {
                    users.push({
                        id: userId,
                        ...currentUser
                    });
                }
            }
            // 设置头像路径
            users.forEach(user => {
                user.avatarPath = `${steamPath}\\config\\avatarcache\\${user.id}.png`
            })
            return users;
        } catch (error) {
            console.error('Failed to read the loginusers.vdf file:', error);
            throw error;
        }
    }

    /**
     * 重新执行steam登录
     * @param username 登录用户名 | 为null登录新用户
     * @returns {Promise<void>}
     */
    async restartSteam(username) {
        // 修改当前登录用户
        await this.setSteamValue('AutoLoginUser', username, Registry.REG_SZ);
        // 获取exe文件路径
        const steamPath = await this.getSteamValue('SteamExe');
        new Promise((resolve, reject) => {
            // 首先，尝试关闭Steam进程
            exec('taskkill /F /IM steam.exe', (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error killing Steam process: ${error}`);
                }
                // 等待一段时间，确保Steam完全退出
                setTimeout(() => {
                    // 然后，启动Steam进程
                    exec(`"${steamPath}"`, (error, stdout, stderr) => {
                        if (error) {
                            reject(`exec error: ${error}\n${stderr}`);
                        }
                        resolve(stdout);
                    });
                }, 100); // 等待0.1秒
            });
        });
    }

    /**
     * 离线登录steam
     * @param username 登录用户名
     * @param online 是否在线登录
     * @returns {Promise<void>}
     */
    async executeExe(username, online) {
        // 读取steam路径
        const steamPath = await this.getSteamValue('SteamPath');
        const vdfPath = `${steamPath}\\config\\loginusers.vdf`;

        // 读取文件内容
        let data = await fs.readFile(vdfPath, 'utf8');

        // 正则表达式匹配用户数据块
        const userBlockRegex = /"(\d+)"\s*{\s*((?:"\w+"\s+"[^"]+",?\s*)*)\s*}/g;
        let match;

        // 查找特定AccountName的用户块
        while ((match = userBlockRegex.exec(data)) !== null) {
            const userId = match[1];
            const fieldsString = match[2];
            // 正则表达式匹配AccountName字段
            const accountNameRegex = new RegExp(`"AccountName"\\s+"${username}"`);
            if (accountNameRegex.test(fieldsString)) {
                // 找到正确的用户块，修改WantsOfflineMode和SkipOfflineModeWarning字段为"1"
                const modifiedFieldsString = fieldsString
                    .replace(/("WantsOfflineMode"\s+")(\d+)(")/g, '$11"1"$3')
                    .replace(/("SkipOfflineModeWarning"\s+")(\d+)(")/g, '$11"1"$3');

                // 替换原始用户数据块
                data = data.replace(userBlockRegex, `"${userId}" {\n${modifiedFieldsString}\n}`);
                break; // 找到匹配的用户后退出循环
            }
        }

        if (!match) {
            console.error(`User block for account name ${username} not found in the VDF file.`);
            return;
        }

        // 将修改后的内容写回文件
        await fs.writeFile(vdfPath, data, 'utf8');
        // 修改当前登录用户
        await this.restartSteam(username);
    }

    /**
     * 在线登录steam
     * @param username 登录用户名
     * @returns {Promise<void>}
     */
    async executeOnlineExe(username) {
        await this.executeExe(username, true)
    }

    /**
     * 离线登录steam
     * @param username 登录用户名
     * @returns {Promise<void>}
     */
    async executeOfflineExe(username) {
        await this.executeExe(username, false)
    }
}

if (typeof window !== 'undefined' && !window.services) {
    window.services = {};
}

/**
 * 挂载window
 * @type {{executeOnlineExe: ((function(*): Promise<void|undefined>)|*), executeOfflineExe: ((function(*): Promise<void|undefined>)|*), readLoginUsersVdf: ((function(): Promise<*[]|undefined>)|*)}}
 */
window.services.steamService = {
    readLoginUsersVdf: async () => {
        const steamService = new SteamService();
        try {
            return await steamService.readLoginUsersVdf();
        } catch (error) {
            console.error('Failed to read Steam login users VDF:', error);
        }
    },
    executeOnlineExe: async (username) => {
        const execService = new SteamService();
        try {
            return await execService.executeOnlineExe(username);
        } catch (error) {
            console.error('Failed to execute EXE:', error);
        }
    }, executeOfflineExe: async (username) => {
        const execService = new SteamService();
        try {
            return await execService.executeOfflineExe(username);
        } catch (error) {
            console.error('Failed to execute EXE:', error);
        }
    }
};