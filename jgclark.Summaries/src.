var lib = require('./');

var { histogram_format, clear_and_log, log, spark_line, clear_lines } = lib;

var data = [0, 1, 2, 3, 4, 5];

function header(title) {
    console.log('\n' + title + '\n')
}

header('default options')
var formatted = histogram_format(data);
console.log(formatted.join('\n'));

header('thin (width = 1)')
var formatted = histogram_format(data, { chart_width: 1 });
log(formatted);

header('longer (width = 14)')
var formatted = histogram_format(data, { chart_width: 14 });
log(formatted);

data = data.map(_ => Math.random() * 1000);
header('random data + standard theme')
var formatted = histogram_format(data);
log(formatted);

header('jim theme')
var formatted = histogram_format(data, 'jim');
log(formatted);

header('equals theme')
var formatted = histogram_format(data, 'equals');
log(formatted);

header('stars theme')
var formatted = histogram_format(data, 'stars');
log(formatted);

header('pipes theme')
var formatted = histogram_format(data, 'pipes');
log(formatted);

header('sparks theme')
var formatted = histogram_format(data, 'sparks');
log(formatted);

header('bitly theme')
var formatted = histogram_format(data, 'bitly');
log(formatted);

header('loop');

var wait = time => new Promise(accept => {
    setTimeout(accept, time);
});


async function histogram_loop() {
    for (var i = 0; i < 14; i++) {
        data = data.map(v => v + Math.random() * 40);
        var formatted = histogram_format(data, { chart_width: 30 });
        clear_and_log(formatted);
        await wait(200);
    }
}

async function test_sparklines() {
    var lines = spark_line([1, 2, 3, 4, 5, 6, 7, 8]);
    header('sparkline');
    console.log(lines);

    var values = new Array(50).fill(100).map(v => Math.random() * v);
    var lines = spark_line(values);
    header('longer sparkline');
    console.log(lines);

    header('animate sparkline');

    console.log('loading...');
    for (i = 0; i < 30; i++) {
        clear_lines(1)
        values = values.map((_, i) => Math.sin(Date.now() * 0.0005 + i * 0.2));
        var lines = spark_line(values);
        console.log(lines);
        await wait(200);

    }
}

async function animations() {
    await histogram_loop();

    await test_sparklines();

}

animations();