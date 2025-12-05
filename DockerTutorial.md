Docker创空间介绍
魔搭创空间支持使用自定义的 Docker 容器，适用于超出 Gradio、Streamlit和Static 范畴的应用。Docker Studios 使用户能够突破以往标准 SDK 的限制，支持FastAPI、Golang、Phoenix、MLOps 等多种类型应用。 本文介绍如何创建、开发并上线一个Docker创空间。主要包括以下步骤：

创建Docker创空间

完成本地项目开发并创建Dockerfile文件

提交并部署应用到 Docker创空间

创建 Docker 创空间#
在 创建创空间-编程式创空间 时选择 Docker 作为 SDK。

代码开发#
本文以开发 Gradio 应用为例，您需要在克隆的本地项目路径下开发并准备好项目工程文件。示例项目目录如下：

Docker_Studio_Example/
├── .gitattributes
├── app.py
├── README.md
└── requirements.txt
新增的app.py及requirements.txt代码文件内容如下：

#app.py
import gradio as gr
def modelscope_quickstart(name):
    return "Welcome to modelscope, " + name + "!!"
demo = gr.Interface(fn=modelscope_quickstart, inputs="text", outputs="text")
demo.launch(server_name="0.0.0.0", server_port=7860)
#requirements.txt
gradio
注意事项：

当部署到Docker创空间时，我们需要将服务暴露在0.0.0.0，并指定服务默认端口为 7860。端口当前暂不支持修改。

在容器内部，您可以开放任意数量的端口。例如，您可以在 创空间 中安装 Elasticsearch，并在内部通过其默认端口 9200 进行调用。

如果您想将多个端口上运行的服务暴露到外部网络，一种变通方法是使用 Nginx 等反向代理，将来自公网（单一端口）的请求分发到不同的内部端口。

因为代码里用到了gradio，我们需要将依赖添加到requirements.txt文件，以便后续在Dockerfile中指定安装依赖。


本地测试#
项目开发调试好后，您需要在本地完成测试，确保项目能够正常运行和访问。然后您就可以开始准备Dockerfile。

构建 Dockerfile#
您可以创建一个 Dockerfile并置于项目根目录下。

Docker_Studio_Example/
├── .gitattributes
├── app.py
├── Dockerfile
├── README.md
└── requirements.txt
当在Docker创空间部署该Gradio应用时，您需要参照如下内容构建Dockerfile：

FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10
WORKDIR /home/user/app
COPY ./ /home/user/app
# 如果有requirements.txt
RUN pip install -r requirements.txt
ENTRYPOINT ["python", "-u", "app.py"]
在该示例的Dockerfile中，我们依次指定基础镜像、设置容器内的工作目录，并将项目文件复制到容器内工作目录中，同时在容器内完成必要的依赖安装，最后定义了容器启动时默认执行的命令：从app.py脚本启动容器。关于 Dockerfile 指令语法的详细用法，您可以前往阅读官方文档了解。

提交并部署到 Docker创空间#
配置好Dockerfile和响应的代码文件后，就可以通过 Git 或前往“站点页面-空间文件-添加文件-上传文件”将代码提交到 Master 分支了。 代码提交完成后，您还需要前往“设置”，点击“上线”创空间。

查看日志#
点击上线后，设置页右侧将出现“查看日志”入口。您可以通过日志抽屉页的构建日志、运行日志分别查看 Dockerfile 的打包过程、启动后的代码运行日志。查看日志

其他设置#
环境变量#
您可以在 创空间 的设置页面中管理环境变量。

构建时（Buildtime）#
Docker创空间当前为 Beta测试状态，变量暂不支持在构建 Docker 镜像时带入。

运行时（Runtime）#
变量会在容器运行时注入到环境中。例如，在 Python 中您可以使用 os.environ.get("ENVIRONMENT_EXAMPLE")。

数据持久化#
每次 Docker 创空间重启时，磁盘上默认写入的数据都会丢失。如果需要持久化存储，您可以使用 /mnt/workspace 目录来存储数据。该目录挂载在一个持久化卷上，这意味着写入此目录的数据将在重启后保留，但是当用户转移、重命名创空间时数据仍会丢失，如有较高需求，建议在 创空间代码中使用外部存储解决方案，例如阿里云OSS存储、托管数据库等。 请注意：/mnt/workspace 卷仅可在运行时使用， Dockerfile 构建阶段无法使用。