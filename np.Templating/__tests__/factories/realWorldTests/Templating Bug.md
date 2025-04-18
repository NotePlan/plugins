---
title: Templating Bug
type: ignore
year: <%- prompt('year', 'Year') %>
month: <%- prompt('month', 'Month') %>
dash9: ---------
---
# Reports Processing <%- year %>-<%- month %>
<%
	const nextMonth = (month == 12 ? 1 : month*1+1)
	const startDate = year + "-" + nextMonth + "-12"
	const accrualDate = year + "-" + nextMonth + "-19"
	const taxDate = year + "-" + nextMonth + "-25"
	const reportStartDate = year + "-" + month + "-01"
-%>
## Phase 1
* Task one #waiting
* Task two #waiting
* Task three
```
// template:ignore

select distinct partner_id
from yt_channels join yt_cms_has_channel
  on yt_channels.id = yt_cms_has_channel.yt_channel_id
join channels on yt_channels.channel_id = channels.id
where yt_cms_has_channel.created_at >= '<%- reportStartDate %>'
  and partner_id is not null
```
- [ ] Task four

## Phase 2
- [ ] Task one  #waiting ><%- startDate %>
* Task two `php artisan reports:all <%- year %> <%- month %>`
* Task three
```
// template:ignore

php artisan youtube:contracts <%- year %> <%- month %> "YUZ8xF09LobG5VrsT3nziw"
php artisan youtube:contracts <%- year %> <%- month %> "ubgww1JeSuGwsLClWEnq5w"
```

## Table
| Some      |  Table   |
|:<%- dash9 %>:|:<%- dash9 %>:|
| TableFlip | was good |

## Code with comments
```
// template:ignore

            # AIR
            'UqbKSnJxR8s2Oxoe6lEyOA' => 'air',
            'Xv7AUokabCFXrn9eQbNzTQ' => 'premium',
            'ubgww1JeSuGwsLClWEnq5w' => 'music',
            'Nxf4STjOynENneSVil78MA' => 'brands',
            'YUZ8xF09LobG5VrsT3nziw' => 'channels',
```
