$(document).ready(function() {
    init_db();

    $("#search_form").submit(function() {
        word = $("#search_field").val();
        $("#search_field").select();
        query(word);
        return false;
    });

    $("#search").click(function() {
        $("#search_field").focus();
    });

    $("#button_add").click(function() {
        word = location.hash.substring(1);
        stroage_word(word);
        wordlist_add(word);
        $("li.current").removeClass("current");
        $("#wordlist_" + escape4id(word)).addClass("current");
        refresh_wordlist_trigger();
        $("#button_add").hide();
        $("#button_remove").show();
    });

    $("#button_remove").click(function() {
        word = location.hash.substring(1);
        remove_word(word);
        $("#wordlist_" + escape4id(word)).remove();
        $("#button_remove").hide();
        $("#button_add").show();
    });

    $("#wordlist").sortable({
        helper: 'clone',
        axis: 'y',
        update: update_word_seq
    });

    /* Update notification */
    cur_version = 2;
    if (!localStorage['prev_version']) {
        localStorage['prev_version'] = 0;
    }
    if (cur_version > localStorage['prev_version']) {
        $("#bubble").html('<p>恭喜！您的 Halo Word 已更新至最新版本，支持<strong>拖动左侧单词进行排序</strong>和<strong>划词查询</strong>等功能。</p><p style="margin-top: 4px;">愿聆听您的建议，请发邮件至 <a href="mailto:liu.dongyuan+halo@gmail.com">liu.dongyuan+halo@gmail.com</a>。</p><p class="align-right"><button  id="button-go-version">查看版本信息</button><button id="button-close-bubble">关闭</button></p>');
        $("#bubble").show();
    }
    $("#button-close-bubble").click(function() {
        localStorage['prev_version'] = cur_version;
        $("#bubble").hide();
    });
    $("#button-go-version").click(function() {
        query("VERSION");
    });

    /* Special fixes */
    var ua = navigator.userAgent.toLowerCase();
    if (ua.indexOf("windows") > 0) {
        /* Special fixes for Windows */
        $("#search_field").css("-webkit-appearance", "none");
    }

    show_def(location.hash.substring(1));
});

function refresh_wordlist_trigger() {
    $("#wordlist li, #title").click(function() {
        word = $(this).text();
        $("li.current").removeClass("current");
        $(this).addClass("current");
        query(word);
    });
    $("#wordlist li").hover(function() {
        $(".delete", this).show();
    }, function() {
        $(".delete", this).hide();
    });
    $("#wordlist .delete").click(function() {
        word = $(this).parent().text();
        remove_word(word);
        $(this).parent().remove();
        if (word == location.hash.substring(1)) {
            $("#button_remove").hide();
            $("#button_add").show();
        }
        return false;
    });
}

/* BUILTIN */

BUILTIN = get_builtin();

function get_builtin() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', chrome.extension.getURL('include/builtin-def.json'), false);
    xhr.send(null);
    var builtin = JSON.parse(xhr.responseText);
    return builtin;
}

/* VERSION */

VERSION = get_version();

function get_version() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', chrome.extension.getURL('manifest.json'), false);
    xhr.send(null);
    var manifest = JSON.parse(xhr.responseText);
    return manifest.version;
}

/* UI */

function on_resize() {
    $("#wordlist").height($(window).height() - 136);
}

$(window).load(on_resize);
$(window).resize(on_resize);

/* STROAGE */

function init_db() {
    db = openDatabase("HaloWord", "0.1", "Database for Halo Word", 200000);
    db.transaction(function (tx) {
        tx.executeSql("SELECT COUNT(*) FROM `Word`", [],
        /* success */
        function(result) {
            update_db();
            init_wordlist();
        },
        /* no table, create them */
        function(tx, error) {
            tx.executeSql("CREATE TABLE `Word` (`id` REAL UNIQUE, `word` TEXT, `timestamp` REAL)", [], null, null);
            var words = ["Capella", "Chrome", "daisy", "Iridium", "turf", "dysprosium", "love", "caesium", "miaow", "喵"];
            /* word list: newest on top */
            stroage_words(words.reverse());
            update_db();
            init_wordlist();
        });
    });
}

function update_db() {
    if (!localStorage['db_version']) {
        localStorage['db_version'] = 1;
    }
    console.log("Checking db version...");
    console.log("Current db version: " + localStorage['db_version'] + ".");
    if (localStorage['db_version'] < 2) {
        /* DB v2: table `word` - add column `sequence` */
        /*        table `word` - add column `status`   */
        console.log("Updating db to version 2...");
        db.transaction(function(tx) {
            tx.executeSql("ALTER TABLE `Word` ADD COLUMN `sequence` REAL", [], null, null);
            tx.executeSql("ALTER TABLE `Word` ADD COLUMN `status` REAL", [], null, null);
        });
        localStorage['db_version'] = 2;
    }
}

function stroage_words(words) {
    var time = new Date().getTime();
    db.transaction(function(tx) {
        for (var w in words) {
            tx.executeSql("INSERT INTO Word (word, timestamp) values(?, ?)",
            [words[w], time],
            null, null);
        }
    });
}

function stroage_word(word) {
    db.transaction(function(tx) {
        tx.executeSql("INSERT INTO `Word` (`word`, `timestamp`) values(?, ?)",
        [word, new Date().getTime()],
        null, null);
    });
}

function update_word_seq() {
    db.transaction(function(tx) {
        $("#wordlist li").each(function(id, obj) {
            tx.executeSql("UPDATE `Word` SET `sequence` = ? WHERE `word` = ?",
            [id, $(obj).text()],
            null, null);
        });
    });
}

function remove_word(word) {
    db.transaction(function(tx) {
        tx.executeSql("DELETE FROM `Word` WHERE `word` = ?",
        [word],
        null, null);
    });
}

function init_wordlist() {
    db.transaction(function(tx) {
        tx.executeSql("SELECT * FROM `Word` ORDER BY `sequence` DESC, `timestamp` ASC", [],
        function(tx, result) {
            for (var i = 0; i < result.rows.length; i++) {
                wordlist_add(result.rows.item(i)['word']);
            }
            refresh_wordlist_trigger();
        }, null);
    });

}

function escape4id(word) {
    return word.replace(/\s/g, "__");
}

function wordlist_add(word) {
    $("#wordlist").prepend('<li id="wordlist_' + escape4id(word) + '"><div class="delete" title="Remove from word list"></div>' + word + "</li>");
}

function wordlist_append(word) {
    $("#wordlist").append('<li id="wordlist_' + escape4id(word) + '"><div class="delete" title="Remove from word list"></div>' + word + "</li>");
}

/* QUERY */

function query(word) {
    location.hash = word;
}

$(window).hashchange(function() {
    show_def(location.hash.substring(1));
});

function show_def(word) {
    if (!word) { word = "WELCOME" };
    $(".button").hide();

    if (word in BUILTIN) {
        if ('redirect' in BUILTIN[word]) { word = BUILTIN[word].redirect; }
        if (word == "WELCOME") {
            document.title = "Halo Word";
        }
        else {
            document.title = BUILTIN[word].title + " ‹ Halo Word";
        }
        $("#wordtitle").html(BUILTIN[word].title);
        html = BUILTIN[word].html.replace(/>>VERSION<</g, '<a href="#about:version">' + VERSION + '</a>')
        $("#worddef").html(html);
        $("#pronounce").click(function() {
            $("audio").attr("src", $("audio").attr("src"));
            $("audio")[0].play();
        });
        return;
    }

    document.title = BUILTIN.LOADING.title + " ‹ Halo Word";
    $("#wordtitle").html(BUILTIN.LOADING.title);
    $("#worddef").html(BUILTIN.LOADING.html);
    $("#pronounce").click(function() {
        $("audio").attr("src", $("audio").attr("src"));
        $("audio")[0].play();
    });

    $.getJSON("http://www.google.com/dictionary/json?callback=?", {
        q: word,
        sl: "en",
        tl: "zh-cn"
    },
    function(data) {
        document.title = word + " ‹ Halo Word";
        $("#wordtitle").html(word);

        db.transaction(function (tx) {
            tx.executeSql("SELECT COUNT(*) AS `exist` FROM `Word` WHERE `word` = ?", [word],
            function(tx, result) {
                if (result.rows.item(0)['exist']) {
                    $("#button_remove").show();
                }
                else {
                    $("#button_add").show();
                }
            }, null);
        });

        if (!data.primaries) {
            $("#worddef").html(BUILTIN.NOTFOUND.html);
            return;
        }
        $("#worddef").html('<a id="pronounce"></a><p id="phonetic"><audio></audio></p>');
        has_pron = false;
        $.each(data.primaries[0].terms, function(i, item) {
            if (item.type == "phonetic") {
                has_pron = true;
                pron = '<span class="phonetic_item">' + item.text;
                $.each(item.labels, function(j, method) {
                    pron += '<span class="extra">' + method.text + '</span>';
                });
                pron += '</span>';
                $("#phonetic").append(pron);
            }
        });
        if (!has_pron) {
            $("#phonetic").append('<span class="phonetic_item notfound">No phonetic notation.</span>');
        }

        meaning = get_meaning(data.primaries[0], false);
        if (meaning) {
            html = '<ol>' + meaning + '</ol>';
            if (html.substring(0, 8) == '<ol></ol>') {
                html = html.substring(9);
            }
            else {
                html = '<ol class="top">' + html.substring(4);
            }
            $("#worddef").append(html);
        }
        else {
            $("#worddef").append('<p class="text">What a strange word...<br />I couldn\'t find it :(</p>');
        }

        pronounce_exist(word);

        $("#worddef").append('<p class="credits">Content provided by <a href="http://www.google.com/dictionary" target="_blank">Google Dictionary</a></p>');
    });
}

function exist_action() {
    $("a#pronounce").addClass("available");
    $("audio").attr("src", pron_url);
    $("#pronounce").click(function() {
        $("audio").attr("src", pron_url);
        $("audio")[0].play();
    });
}
