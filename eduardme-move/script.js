function init() {
	return "init done";
}

async function selectFolder() {
    if(Editor.type == "Notes") {

        // [String] list of options, placeholder text, callback function with selection
        let folder = await CommandBar.showOptions(DataStore.folders, "Select new folder for '" + Editor.title + "'")
        moveNote(folder.value)
        
    } else {
        console.log("can't move calendar notes.")
        CommandBar.hide()
    }
}

function moveNote(selectedFolder) {
    console.log("move " + Editor.title + " (filename = '" + Editor.filename + "')" + " to " + selectedFolder)
    var newFilename = DataStore.moveNote(Editor.filename, selectedFolder)
    
    if(newFilename != undefined) {
        Editor.openNoteByFilename(newFilename)
        console.log("moving note was successful")
    } else {
        console.log("moving note was NOT successful")
    }
}
