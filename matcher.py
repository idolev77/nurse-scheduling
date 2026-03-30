from scipy.sparse import csr_array
from scipy.sparse.csgraph import maximum_flow


class Matcher:
    def __init__(self, graph):
        self.source = 0
        self.sink = len(graph) - 1
        self.graph = csr_array(graph)

    def run_algorithm(self):
        output = maximum_flow(self.graph, self.source, self.sink)
        res_graph = output.flow
        res_value = output.flow_value
        res = (res_graph, res_value)
        return res

    def print_result(self, res):
        for row in range(1, self.sink):
            for col in range(row,self.sink ):
                if res[row][col] != 0:
                    print(f'{row} ---- ({res[row][col]}) ---> {col}')



