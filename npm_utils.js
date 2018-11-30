const npm = require('npm')
const mv = require('mv')
const curry = require('lodash.curry')
const async = require('async')

const publishAsync = function (registry, path, callback) {
    console.log('publishAsync', registry, path)
    npm.load({
        registry: registry,
        
        "strict-ssl": false,
        "always-auth": true
        
    }, () => {

        let tgz = path + '.tgz'
        console.log('loaded, publishing', tgz)
        npm.commands.publish([tgz], (err, data) => {

            if (err) return callback(err);

            callback(null, path)
        })
    })
}

const getTarball = function (moduleName, registry, version, callback) {
    console.log('getTarball', moduleName, registry, version);
    const versionedModule = [moduleName, version].join('@')

    npm.load({
        registry: registry,
        
        "strict-ssl": false,
        "always-auth": true
    }, () => {
        console.log('loaded calling pack', moduleName, registry, version);
        npm.commands.pack([versionedModule], (err, data) => {

            if (err) return callback(err);

            const tarballEscaped = versionedModule
              .replace(/^@/, '') // remove first @
              .replace('@','-') // change @0.0.0 to -0.0.0
              .replace('/', '-'); // change scope/ to scope-
            const tarball = `${tarballEscaped}.tgz`;
            const tarballFrom = process.cwd() + '/' + tarball
            const tarballTo = process.cwd() + '/npm-migrate_tmp/' + tarball

            mv(tarballFrom, tarballTo, { mkdirp: true }, (err) => {

                if (err) return callback(err);

                callback(null, tarballTo)
            })
        })
    })

}

function getRemainingVersions (moduleName, oldRegistry, newRegistry, oldRegistryVersions, newRegistryNpmOptions) {

    return new Promise((resolve) => {

        npm.config.set('registry', newRegistry);
        npm.commands.info([moduleName], (err, data) => {

            if (err) {
                return resolve(oldRegistryVersions);
            }
        
            const latest = Object.keys(data)[0];
            const newRegistryVersions = data[latest].versions;
            console.log('New Registry Versions', newRegistryVersions);

            remainingVersions = oldRegistryVersions.filter((v) => !newRegistryVersions.includes(v));
            if (!remainingVersions.length) {
                console.log('No more versions of this package to migrate');
            } else {
                console.log('Remaining Versions to Migrate', remainingVersions);
            }

            resolve(remainingVersions);

        });
        npm.config.set('registry', oldRegistry);

  });

}

module.exports.getVersionList = function (moduleName, oldRegistry, newRegistry, oldRegistryNpmOptions = {}, newRegistryNpmOptions = {}) {

    return new Promise((resolve, reject) => {

        npm.load({
            registry: oldRegistry,
            
            "strict-ssl": false,
            "always-auth": true
        }, () => {

            npm.commands.info([moduleName], function (err, data) {

                if (err) return reject(err);

                const latest = Object.keys(data)[0];
                const oldRegistryVersions = data[latest].versions;
                console.log('Old Registry Versions', oldRegistryVersions);

                return getRemainingVersions(moduleName, oldRegistry, newRegistry, oldRegistryVersions, newRegistryNpmOptions)
                    .then((remainingVersions) => {
                        resolve(remainingVersions);
                    });
            })
        })
    })
}


module.exports.getTarballs = function (moduleName, registry, versions) {
    console.log('getTarballs', moduleName, registry, versions)
    let curried_getTarball = curry(getTarball)
    let series = versions.map((version) => curried_getTarball(moduleName, registry, version))

    return new Promise((resolve, reject) => {
        async.series(
            series,
            (err, results) => {
                if (err) return reject(err);
                resolve(results)
            })
    })
}




module.exports.publishSeries = function (registry, packageFolders) {
    console.log('publishSeries', registry, packageFolders)
    let curried_publishAsync = curry(publishAsync),
        series = packageFolders.map((folder) => curried_publishAsync(registry, folder))

    return new Promise((resolve, reject) => {
        async.series(
            series,
            (err, results) => {
                if (err) return reject(err);
                resolve(results)
            })
    })
}

const packageFromPath = function (path) {
    console.log('packageFromPath', path)
    return path
            .replace(process.cwd() + '/npm-migrate_tmp/', '')
            .replace('/package', '')
}

module.exports.packageFromPaths = function (paths) {
    return paths.map(packageFromPath)
}

module.exports.packageFromPath = packageFromPath;
