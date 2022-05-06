import { rbql } from 'rbql'
import { clo } from '../../../helpers/dev'

// async function query_table(user_query, input_table, output_table, output_warnings, join_table=null, input_column_names=null, join_column_names=null, output_column_names=null, normalize_column_names=true)
export function testDB() {
  const result = rbql.query_table('SELECT *', 'a,b,c,d\n1,2,3,4', foo, 'test', null, 'a,b,c,d', 'a,b,c,d', 'a,b,c,d')
  clo(result)
  return
}
