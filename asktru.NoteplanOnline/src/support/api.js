// @flow

export function doPublish(title, content, secret, accessKey)
{
    return fetch('https://noteplan.online/api/publishedNote', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'password': secret,
            'accessKey': accessKey,
            'title': title,
            'content': content
        })
    });
}

export function doUpdatePublished(guid, title, content, secret, accessKey)
{
    return fetch('https://noteplan.online/api/publishedNote', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'guid': guid,
            'password': secret,
            'accessKey': accessKey,
            'title': title,
            'content': content
        })
    });
}

export function doUnpublish(guid, accessKey)
{
    return fetch('https://noteplan.online/api/publishedNote', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'guid': guid,
            'accessKey': accessKey
        })
    });
}
