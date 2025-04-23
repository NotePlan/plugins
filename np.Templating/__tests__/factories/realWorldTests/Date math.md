---
title: Date math
type: ignore 
---
Date now: <%= np.date.now() %>
Date now with format: <%= np.date.now("Do MMMM YYYY") %>

Last week: <%= np.date.now("dddd Do MMMM YYYY", -7) %>
Today: <%= np.date.now("dddd Do MMMM YYYY, ddd") %>
Next week: <%= np.date.now("dddd Do MMMM YYYY", 7) %>

Last month: <%= np.date.now("YYYY-MM-DD", "P-1M") %>
Next year: <%= np.date.now("YYYY-MM-DD", "P1Y") %>

Date tomorrow with format: <%= np.date.tomorrow("Do MMMM YYYY") %>

This week's monday: <%= np.date.weekday("YYYY-MM-DD", 0) %>
Next monday: <%= np.date.weekday("YYYY-MM-DD", 7) %>

Date yesterday with format: <%= np.date.yesterday("Do MMMM YYYY") %>

90d ago: <%= np.date.now("dddd Do MMMM YYYY", "-90 days") %>

Date now: 2022-05-02
Date now with format: 2nd May 2022

Last week: Monday 25th April 2022
Today: Monday 2nd May 2022, Mon
Next week: Monday 9th May 2022

Last month: 2022-04-02
Next year: 2023-05-02

Date tomorrow with format: 3rd May 2022

This week's monday: 2022-05-01
Next monday: 2022-05-08

Date yesterday with format: 1st May 2022

90d ago: Monday 2nd May 2022

