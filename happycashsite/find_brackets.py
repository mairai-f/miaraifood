def find_mismatch(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    lines = content.split('\n')
    
    for i, line in enumerate(lines):
        for j, char in enumerate(line):
            if char in '{[':
                stack.append((char, i+1, j+1))
            elif char in '}]':
                if not stack:
                    print(f"Unmatched closing '{char}' at line {i+1}, col {j+1}")
                    return
                top, top_line, top_col = stack.pop()
                if (top == '{' and char != '}') or (top == '[' and char != ']'):
                    print(f"Mismatched closing '{char}' at line {i+1}, col {j+1}. Expected closing for '{top}' from line {top_line}")
                    return
    
    if stack:
        print("Unclosed brackets:")
        for bracket, line, col in stack:
            print(f"'{bracket}' opened at line {line}, col {col}")
    else:
        print("No mismatches found.")

find_mismatch('/home/celio/Documentos/happycashsite/src/data/portfolio.ts')
