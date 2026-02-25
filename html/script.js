// ─────────────────────────────────────────────────────────────
//  QB-Clothing  ·  NUI Script
//  Works with the modern design HTML (option-row / ctrl-btn)
//  and fires all original qb-clothing NUI callbacks
// ─────────────────────────────────────────────────────────────

var QBClothing       = {};
var clothingCategorys = {};
var hasTracker        = false;
var canChange         = true;
var translations      = {};
var selectedCam       = null;   // currently active view-tab element
var activePanelId     = null;   // e.g. "panel-character"

// ─── helpers ─────────────────────────────────────────────────

function nuiPost(endpoint, data) {
    return $.post('https://qb-clothing/' + endpoint, JSON.stringify(data || {}));
}

// Climb up past the button's own data-type to the containing option-row/slider-row
function getCategory(el) {
    return $(el).closest('.option-row, .slider-row').data('type');
}

// The input lives as a sibling inside the same .option-controls as the button
function getInput(el, type) {
    return $(el).siblings('input[data-type="' + type + '"]');
}

// Get max item value from the option-row's texture-header or item-header sub-label
function getMaxItem(el) {
    return $(el).closest('.option-row, .slider-row').find('[data-headertype="item-header"]').data('maxItem');
}

function getMaxTexture(el) {
    return $(el).closest('.option-row, .slider-row').find('[data-headertype="texture-header"]').data('maxTexture');
}

// ─── Tab switching ────────────────────────────────────────────
// Tabs are injected into #sectionNav by Open().
// Each tab has data-panel="panel-character" etc.
$(document).on('click', '.section-tab', function () {
    var panelId = $(this).data('panel');
    $('.section-tab').removeClass('active');
    $(this).addClass('active');
    $('.section-panel').removeClass('active');
    $('#' + panelId).addClass('active');
    activePanelId = panelId;
});

// ─── Camera zone tabs ─────────────────────────────────────────
$(document).on('click', '.view-tab', function () {
    var camVal = parseFloat($(this).data('cam'));

    if (selectedCam === null) {
        $(this).addClass('active');
        nuiPost('setupCam', { value: camVal });
        selectedCam = this;
    } else {
        if (selectedCam === this) {
            $(this).removeClass('active');
            nuiPost('setupCam', { value: 0 });
            selectedCam = null;
        } else {
            $(selectedCam).removeClass('active');
            $(this).addClass('active');
            nuiPost('setupCam', { value: camVal });
            selectedCam = this;
        }
    }
});

// ─── Camera rotation buttons (top-left widget) ───────────────
$(document).on('click', '.rotate-btn', function (e) {
    e.preventDefault();
    nuiPost('rotateCam', { type: $(this).data('rotation') });
});

// ─── Keyboard shortcuts ───────────────────────────────────────
$(document).on('keydown', function (e) {
    switch (e.keyCode) {
        case 68: nuiPost('rotateRight'); break;   // D
        case 65: nuiPost('rotateLeft');  break;   // A
    }
});

// ─── Right stepper ────────────────────────────────────────────
$(document).on('click', '.qb-right', function (e) {
    e.preventDefault();
    if (!canChange) return;

    var clothingCategory = getCategory(this);
    var buttonType       = $(this).data('type');
    var inputElem        = getInput(this, buttonType);
    var newValue         = parseFloat($(inputElem).val()) + 1;

    if (hasTracker && clothingCategory === 'accessory') {
        nuiPost('TrackerError'); return;
    }

    if (clothingCategory === 'model') {
        $(inputElem).val(newValue);
        nuiPost('setCurrentPed', { ped: newValue }).done(function (model) {
            $('#current-model').text(model);
        });
        QBClothing.ResetValues();
        return;
    }

    if (clothingCategory === 'hair') {
        $(inputElem).val(newValue);
        nuiPost('updateSkin', { clothingType: clothingCategory, articleNumber: newValue, type: buttonType });
        if (buttonType === 'item') QBClothing.ResetItemTexture(this, clothingCategory);
        return;
    }

    if (buttonType === 'item') {
        var maxItem = parseInt(getMaxItem(this));
        if (clothingCategory === 'accessory' && newValue === 13) { newValue = 14; }
        if (isNaN(maxItem) || newValue <= maxItem) {
            $(inputElem).val(newValue);
            nuiPost('updateSkin', { clothingType: clothingCategory, articleNumber: newValue, type: buttonType });
        }
        QBClothing.ResetItemTexture(this, clothingCategory);
    } else {
        var maxTex = parseInt(getMaxTexture(this));
        if (isNaN(maxTex) || newValue <= maxTex) {
            $(inputElem).val(newValue);
            nuiPost('updateSkin', { clothingType: clothingCategory, articleNumber: newValue, type: buttonType });
        }
    }
});

// ─── Left stepper ─────────────────────────────────────────────
$(document).on('click', '.qb-left', function (e) {
    e.preventDefault();
    if (!canChange) return;

    var clothingCategory = getCategory(this);
    var buttonType       = $(this).data('type');
    var inputElem        = getInput(this, buttonType);
    var newValue         = parseFloat($(inputElem).val()) - 1;

    if (hasTracker && clothingCategory === 'accessory') {
        nuiPost('TrackerError'); return;
    }

    if (clothingCategory === 'model') {
        if (newValue !== 0) {
            $(inputElem).val(newValue);
            nuiPost('setCurrentPed', { ped: newValue }).done(function (model) {
                $('#current-model').text(model);
            });
            QBClothing.ResetValues();
        }
        return;
    }

    var cat = clothingCategorys[clothingCategory] || {};

    if (buttonType === 'item') {
        var minItem = cat.defaultItem !== undefined ? cat.defaultItem : -1;
        if (clothingCategory === 'accessory' && newValue === 13) { newValue = 12; }
        if (newValue >= minItem) {
            $(inputElem).val(newValue);
            nuiPost('updateSkin', { clothingType: clothingCategory, articleNumber: newValue, type: buttonType });
        }
        QBClothing.ResetItemTexture(this, clothingCategory);
    } else {
        var minTex = cat.defaultTexture !== undefined ? cat.defaultTexture : -1;
        if (clothingCategory === 'accessory' && newValue === 13) { newValue = 12; }
        if (newValue >= minTex) {
            $(inputElem).val(newValue);
            nuiPost('updateSkin', { clothingType: clothingCategory, articleNumber: newValue, type: buttonType });
        }
    }
});

// ─── Direct number input ──────────────────────────────────────
$(document).on('change', '.item-number', function () {
    var clothingCategory = getCategory(this);
    var buttonType       = $(this).data('type');
    var inputVal         = parseFloat($(this).val());

    if (!clothingCategory) return; // sliders handled separately

    if (hasTracker && clothingCategory === 'accessory') {
        nuiPost('TrackerError');
        $(this).val(13);
        return;
    }
    if (clothingCategory === 'accessory' && inputVal === 13) {
        $(this).val(12); return;
    }

    nuiPost('updateSkinOnInput', { clothingType: clothingCategory, articleNumber: inputVal, type: buttonType });
});

// ─── Sliders (facemix shapeMix / skinMix) ────────────────────
$(document).on('input', '.qb-slider', function () {
    var sliderType = $(this).data('type'); // "shapeMix" or "skinMix"
    var val        = parseFloat($(this).val());
    nuiPost('updateSkin', { clothingType: 'facemix', articleNumber: val, type: sliderType });
});

// ─── Reset item texture helper ────────────────────────────────
QBClothing.ResetItemTexture = function (el, category) {
    var cat        = clothingCategorys[category] || {};
    var defaultTex = cat.defaultTexture !== undefined ? cat.defaultTexture : 0;
    var row        = $(el).closest('.option-row, .slider-row');
    row.find('input[data-type="texture"]').val(defaultTex);
    nuiPost('updateSkin', { clothingType: category, articleNumber: defaultTex, type: 'texture' });
};

// ─── Footer: Save ─────────────────────────────────────────────
$(document).on('click', '#btn-save', function (e) {
    e.preventDefault();
    QBClothing.Close();
    nuiPost('saveClothing');
});

// ─── Footer: Cancel ───────────────────────────────────────────
$(document).on('click', '#btn-cancel', function (e) {
    e.preventDefault();
    QBClothing.Close();
    nuiPost('resetOutfit');
});

// ─── Footer: Reset ────────────────────────────────────────────
$(document).on('click', '#btn-reset', function (e) {
    e.preventDefault();
    QBClothing.ResetValues();
});

// ─── Save Outfit button (opens modal + slides panel away) ─────
$(document).on('click', '#save-outfit', function (e) {
    e.preventDefault();
    $('#app').addClass('app-slide-out');
    $('#outfit-modal').fadeIn(180);
});

$(document).on('click', '#save-outfit-save', function (e) {
    e.preventDefault();
    var name = $('#outfit-name').val();
    $('#outfit-modal').fadeOut(180);
    $('#app').removeClass('app-slide-out');
    nuiPost('saveOutfit', { outfitName: name });
});

$(document).on('click', '#cancel-outfit-save', function (e) {
    e.preventDefault();
    $('#outfit-modal').fadeOut(180);
    $('#app').removeClass('app-slide-out');
});

// ─── Room outfit select ───────────────────────────────────────
$(document).on('click', '.outfit-select-btn', function (e) {
    e.preventDefault();
    var oData = $(this).closest('.outfit-card').data('outfitData');
    nuiPost('selectOutfit', { outfitData: oData.outfitData, outfitName: oData.outfitLabel });
});

// ─── My outfit select / delete ───────────────────────────────
$(document).on('click', '.my-outfit-select-btn', function (e) {
    e.preventDefault();
    var oData = $(this).closest('.outfit-card').data('myOutfitData');
    nuiPost('selectOutfit', { outfitData: oData.skin, outfitName: oData.outfitname, outfitId: oData.outfitId });
});

$(document).on('click', '.my-outfit-delete-btn', function (e) {
    e.preventDefault();
    var oData = $(this).closest('.outfit-card').data('myOutfitData');
    nuiPost('removeOutfit', { outfitData: oData.skin, outfitName: oData.outfitname, outfitId: oData.outfitId });
});

// ─── Close ───────────────────────────────────────────────────
QBClothing.Close = function () {
    nuiPost('close');
    $('#app').animate({ right: '-420px' }, 220, function () {
        $('#app').hide().css('right', '');
    });
};

// ─── Set max values (called from Lua via message) ─────────────
QBClothing.SetMaxValues = function (maxValues) {
    $.each(maxValues, function (key, cat) {
        // find the row anywhere in #app
        var row = $('#app').find('[data-type="' + key + '"]').first();
        if (!row.length) return;

        var itemHeader    = row.find('[data-headertype="item-header"]');
        var textureHeader = row.find('[data-headertype="texture-header"]');

        itemHeader.data('maxItem', cat.item);
        textureHeader.data('maxTexture', cat.texture);

        row.find('input[data-type="item"]').attr({ max: cat.item, min: -1 });
        row.find('input[data-type="texture"]').attr({ max: cat.texture, min: -1 });
    });
};

// ─── Reset values to defaults ─────────────────────────────────
QBClothing.ResetValues = function () {
    $.each(clothingCategorys, function (key, cat) {
        var row = $('#app').find('[data-type="' + key + '"]');
        row.find('input[data-type="item"]').val(cat.defaultItem);
        row.find('input[data-type="texture"]').val(cat.defaultTexture);
    });
};

// ─── Set current clothing values ─────────────────────────────
QBClothing.SetCurrentValues = function (clothingValues) {
    $.each(clothingValues, function (key, item) {
        if (key === 'facemix') {
            $('#shapeMix').val(item.shapeMix);
            $('#skinMix').val(item.skinMix);
            $('#shapeMixVal').text(parseFloat(item.shapeMix).toFixed(2));
            $('#skinMixVal').text(parseFloat(item.skinMix).toFixed(2));
            return;
        }
        var row = $('#app').find('[data-type="' + key + '"]');
        row.find('input[data-type="item"]').val(item.item);
        row.find('input[data-type="texture"]').val(item.texture);
    });
};

// ─── Reload my outfits ────────────────────────────────────────
QBClothing.ReloadOutfits = function (outfits) {
    var $panel = $('#panel-myOutfits').empty();
    $.each(outfits, function (i, outfit) {
        var card = $('<div class="outfit-card"></div>');
        card.data('myOutfitData', outfit);
        card.append('<p class="outfit-card-name">' + outfit.outfitname + '</p>');
        card.append('<button class="btn btn-primary my-outfit-select-btn">Select</button>');
        card.append('<button class="btn btn-danger my-outfit-delete-btn">Delete</button>');
        $panel.append(card);
    });
};

// ─── Open ─────────────────────────────────────────────────────
QBClothing.Open = function (data) {
    clothingCategorys = data.currentClothing;
    hasTracker        = !!data.hasTracker;

    // Show cam rotate widget

    // Reset camera tab state
    if (selectedCam) { $(selectedCam).removeClass('active'); selectedCam = null; }
    // Default first view-tab active
    var firstTab = $('.view-tab').first().addClass('active');
    selectedCam = firstTab[0];
    nuiPost('setupCam', { value: parseFloat(firstTab.data('cam')) || 0 });

    // Build section nav tabs
    var $nav = $('#sectionNav').empty();
    var firstPanel = null;

    $.each(data.menus, function (i, menu) {
        var panelId = 'panel-' + menu.menu;
        var $tab = $('<button class="section-tab" data-panel="' + panelId + '">' + menu.label + '</button>');
        $nav.append($tab);

        if (menu.selected || firstPanel === null) {
            if (firstPanel === null || menu.selected) firstPanel = panelId;
        }

        // Populate outfits
        if (menu.menu === 'roomOutfits') {
            var $panel = $('#panel-roomOutfits').empty();
            $.each(menu.outfits || [], function (j, outfit) {
                var card = $('<div class="outfit-card"></div>');
                card.data('outfitData', outfit);
                card.append('<p class="outfit-card-name">' + outfit.outfitLabel + '</p>');
                card.append('<button class="btn btn-primary outfit-select-btn">Select Outfit</button>');
                $panel.append(card);
            });
        }

        if (menu.menu === 'myOutfits') {
            var $panel2 = $('#panel-myOutfits').empty();
            $.each(menu.outfits || [], function (j, outfit) {
                var card = $('<div class="outfit-card"></div>');
                card.data('myOutfitData', outfit);
                card.append('<p class="outfit-card-name">' + outfit.outfitname + '</p>');
                card.append('<button class="btn btn-primary my-outfit-select-btn">Select</button>');
                card.append('<button class="btn btn-danger my-outfit-delete-btn">Delete</button>');
                $panel2.append(card);
            });
        }
    });

    // Activate first panel
    if (firstPanel) {
        $('[data-panel="' + firstPanel + '"]').addClass('active');
        $('.section-panel').removeClass('active');
        $('#' + firstPanel).addClass('active');
        activePanelId = firstPanel;
    }

    // Hide face/model rows when in clothing-only mode
    if (data.menus.length === 1 && data.menus[0].label === 'Clothing') {
        $('[data-type="face"], [data-type="face2"], [data-type="facemix"], [data-type="model"]').hide();
    } else {
        $('[data-type="face"], [data-type="face2"], [data-type="facemix"], [data-type="model"]').show();
    }

    QBClothing.SetMaxValues(data.maxValues);
    QBClothing.SetCurrentValues(data.currentClothing);

    // Show panel with slide-in
    $('#app').css({ display: 'flex', right: '-420px' }).animate({ right: '20px' }, 250);

    // Apply translations
    translate();
};

// ─── Translations ─────────────────────────────────────────────
function translatePhrase(phrase, fallback) {
    return translations[phrase] || fallback;
}

function translate() {
    for (var key in translations) {
        var els = $('[data-tkey="' + key + '"]');
        els.text(translatePhrase(key, els.text()));
    }
}

// ─── NUI message listener ─────────────────────────────────────
$(document).ready(function () {
    window.addEventListener('message', function (event) {
        if (event.data.translations) {
            translations = event.data.translations;
            translate();
        }
        switch (event.data.action) {
            case 'open':           QBClothing.Open(event.data);                break;
            case 'close':          QBClothing.Close();                          break;
            case 'updateMax':      QBClothing.SetMaxValues(event.data.maxValues); break;
            case 'reloadMyOutfits':QBClothing.ReloadOutfits(event.data.outfits); break;
            case 'toggleChange':   canChange = event.data.allow;               break;
            case 'ResetValues':    QBClothing.ResetValues();                   break;
        }
    });
});